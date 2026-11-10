// Meetups (G14, Kajabi community meetups): a scheduled session for one access group with an
// external join link. Members RSVP until it ends, see the link from JOIN_OPENS_MINUTES before
// the start until the end, and the replay (Vimeo) afterwards. Staff always see the link.
// The calendar file points at the meetup page, so the link never leaks early.
import type { Viewer } from '@/lib/auth/viewer';
import { icsFor } from '@/lib/calendar/ics';
import type { CommandResult } from '@/lib/data/commandResult';
import type { Repo } from '@/lib/data/repo';
import type { Meetup, MeetupRsvp, Product } from '@/lib/data/types';
import { communityAccess, reachesGroup, type CommunityAccess } from './access';

export const JOIN_OPENS_MINUTES = 15;
const MINUTE_MS = 60_000;

export type MeetupState = 'upcoming' | 'live' | 'past';
export type MeetupItem = Omit<Meetup, 'location'> & {
  state: MeetupState;
  /** Shown only while joinable (staff: always). */
  joinUrl: string | null;
  rsvpCount: number;
  going: boolean;
};
export type MeetupList = { upcoming: MeetupItem[]; past: MeetupItem[] };
export type MeetupCommand = { op: 'rsvp'; meetupId: string; on: boolean };

const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

export const meetupState = (m: Meetup, now: Date): MeetupState =>
  now < m.startsAt ? 'upcoming' : now > m.endsAt ? 'past' : 'live';

const visible = (access: CommunityAccess, m: Meetup): boolean => access.meetups && reachesGroup(access, m.accessGroupId);

function toItem(m: Meetup, rsvps: readonly MeetupRsvp[], access: CommunityAccess, me: string | undefined, now: Date): MeetupItem {
  const { location, ...rest } = m;
  const state = meetupState(m, now);
  const joinable = now.getTime() >= m.startsAt.getTime() - JOIN_OPENS_MINUTES * MINUTE_MS && state !== 'past';
  return {
    ...rest,
    replayVimeoId: state === 'past' ? m.replayVimeoId : null,
    state,
    joinUrl: access.staff || joinable ? location : null,
    rsvpCount: rsvps.length,
    going: rsvps.some((r) => r.profileId === me),
  };
}

export async function meetupList(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  now: Date,
): Promise<MeetupList | null> {
  if (!access.read || !access.meetups) return null;
  const shown = (await repo.meetups(community.id)).filter((m) => visible(access, m));
  const rsvps = await Promise.all(shown.map((m) => repo.meetupRsvps(m.id)));
  const items = shown.map((m, i) => toItem(m, rsvps[i] ?? [], access, viewer.profile?.id, now));
  return {
    upcoming: items.filter((m) => m.state !== 'past'),
    past: items.filter((m) => m.state === 'past').toReversed(),
  };
}

async function visibleMeetup(repo: Repo, community: Product, access: CommunityAccess, id: string): Promise<Meetup | null> {
  const m = await repo.meetup(id);
  return m && m.communityId === community.id && visible(access, m) ? m : null;
}

export async function meetupItem(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  id: string,
  now: Date,
): Promise<MeetupItem | null> {
  const m = await visibleMeetup(repo, community, access, id);
  return m && toItem(m, await repo.meetupRsvps(m.id), access, viewer.profile?.id, now);
}

/** "Add to calendar" file; `pageUrl` = the meetup page on the space's domain. */
export async function meetupIcs(
  repo: Repo,
  community: Product,
  access: CommunityAccess,
  id: string,
  pageUrl: string,
  now: Date,
): Promise<string | null> {
  const m = await visibleMeetup(repo, community, access, id);
  if (!m) return null;
  return icsFor({
    uid: `${m.id}@masterclass`,
    title: m.title,
    description: `${m.description}\n\n${pageUrl}`,
    location: pageUrl,
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    stamp: now,
  });
}

export async function meetupCommand(repo: Repo, viewer: Viewer, cmd: MeetupCommand, now: Date): Promise<CommandResult> {
  const me = viewer.profile?.id;
  const m = await repo.meetup(cmd.meetupId);
  const community = m && (await repo.product(m.communityId));
  if (!me || !m || !community) return NOT_FOUND;
  if (!visible(await communityAccess(repo, viewer, community, now), m)) return NOT_FOUND;
  if (meetupState(m, now) === 'past') return { ok: false, error: 'invalid', message: 'This meetup has ended.' };
  await repo.setRsvp(m.id, me, cmd.on, now);
  return { ok: true };
}
