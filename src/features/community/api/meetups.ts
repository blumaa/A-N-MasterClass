// Meetups (G14, Kajabi community meetups): a scheduled session for one access group with an
// external join link. A meetup may repeat (Launch 6 item 8); each occurrence is computed, has its
// own URL key, RSVPs and calendar entry, and can be edited or cancelled on its own. Members RSVP
// until it ends, see the link from JOIN_OPENS_MINUTES before the start until the end, and the
// replay (Vimeo) afterwards. Staff always see the link. The calendar file points at the meetup
// page, so the link never leaks early.
import type { Viewer } from '@/lib/auth/viewer';
import { icsFor } from '@/lib/calendar/ics';
import { nearOccurrences, occurrenceKey, occurrenceOf, parseOccurrenceKey, type Occurrence } from '@/lib/calendar/recurrence';
import type { CommandResult } from '@/lib/data/commandResult';
import type { Repo } from '@/lib/data/repo';
import type { Meetup, MeetupOccurrence, MeetupRsvp, Product } from '@/lib/data/types';
import { communityAccess, reachesGroup, type CommunityAccess } from './access';

export const JOIN_OPENS_MINUTES = 15;
/** Listing bound per series: the last ended occurrences and the next ones. */
export const PAST_PER_SERIES = 3;
export const UPCOMING_PER_SERIES = 10;
const MINUTE_MS = 60_000;

export type MeetupState = 'upcoming' | 'live' | 'past';
export type MeetupItem = Omit<Meetup, 'location'> & {
  /** URL key: the id for occurrence 0, else `id_n`. */
  key: string;
  occurrence: number;
  state: MeetupState;
  /** Shown only while joinable (staff: always). */
  joinUrl: string | null;
  rsvpCount: number;
  going: boolean;
};
export type MeetupList = { upcoming: MeetupItem[]; past: MeetupItem[] };
export type MeetupCommand = { op: 'rsvp'; meetupId: string; occurrence: number; on: boolean };

const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

export const meetupState = (w: { startsAt: Date; endsAt: Date }, now: Date): MeetupState =>
  now < w.startsAt ? 'upcoming' : now > w.endsAt ? 'past' : 'live';

const visible = (access: CommunityAccess, m: Meetup): boolean => access.meetups && reachesGroup(access, m.accessGroupId);

type Ctx = { access: CommunityAccess; me: string | undefined; now: Date };

function toItem(m: Meetup, o: Occurrence, rsvps: readonly MeetupRsvp[], { access, me, now }: Ctx): MeetupItem {
  const { location, ...rest } = m;
  const state = meetupState(o, now);
  const joinable = now.getTime() >= o.startsAt.getTime() - JOIN_OPENS_MINUTES * MINUTE_MS && state !== 'past';
  const mine = rsvps.filter((r) => r.occurrence === o.n);
  return {
    ...rest,
    key: occurrenceKey(m.id, o.n),
    occurrence: o.n,
    title: o.title,
    description: o.description,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    replayVimeoId: state === 'past' ? o.replayVimeoId : null,
    state,
    joinUrl: access.staff || joinable ? location : null,
    rsvpCount: mine.length,
    going: mine.some((r) => r.profileId === me),
  };
}

/** Shown (not cancelled) occurrence n of a meetup, with its edit applied. */
const shownOccurrence = (m: Meetup, n: number, edits: readonly MeetupOccurrence[]): Occurrence | null => {
  const o = occurrenceOf(
    m,
    n,
    edits.find((e) => e.occurrence === n),
  );
  return o && !o.cancelled ? o : null;
};

async function seriesItems(repo: Repo, m: Meetup, ctx: Ctx): Promise<MeetupItem[]> {
  const [edits, rsvps] = await Promise.all([repo.meetupOccurrences(m.id), repo.meetupRsvps(m.id)]);
  const { past, upcoming } = nearOccurrences(m, ctx.now, PAST_PER_SERIES, UPCOMING_PER_SERIES);
  return [...past, ...upcoming].flatMap((n) => {
    const o = shownOccurrence(m, n, edits);
    return o ? [toItem(m, o, rsvps, ctx)] : [];
  });
}

const byStart = (a: MeetupItem, b: MeetupItem) => a.startsAt.getTime() - b.startsAt.getTime();

export async function meetupList(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  now: Date,
): Promise<MeetupList | null> {
  if (!access.read || !access.meetups) return null;
  const ctx = { access, me: viewer.profile?.id, now };
  const shown = (await repo.meetups(community.id)).filter((m) => visible(access, m));
  const items = (await Promise.all(shown.map((m) => seriesItems(repo, m, ctx)))).flat();
  return {
    upcoming: items.filter((m) => m.state !== 'past').toSorted(byStart),
    past: items
      .filter((m) => m.state === 'past')
      .toSorted(byStart)
      .toReversed(),
  };
}

type Found = { m: Meetup; o: Occurrence; edits: MeetupOccurrence[] };

async function visibleOccurrence(
  repo: Repo,
  community: Product,
  access: CommunityAccess,
  id: string,
  n: number,
): Promise<Found | null> {
  const m = await repo.meetup(id);
  if (!m || m.communityId !== community.id || !visible(access, m)) return null;
  const edits = await repo.meetupOccurrences(m.id);
  const o = shownOccurrence(m, n, edits);
  return o && { m, o, edits };
}

const byKey = (repo: Repo, community: Product, access: CommunityAccess, key: string) => {
  const k = parseOccurrenceKey(key);
  return k ? visibleOccurrence(repo, community, access, k.id, k.n) : Promise.resolve(null);
};

export async function meetupItem(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  key: string,
  now: Date,
): Promise<MeetupItem | null> {
  const f = await byKey(repo, community, access, key);
  return f && toItem(f.m, f.o, await repo.meetupRsvps(f.m.id), { access, me: viewer.profile?.id, now });
}

/** "Add to calendar" file for one occurrence; `pageUrl` = its page on the space's domain. */
export async function meetupIcs(
  repo: Repo,
  community: Product,
  access: CommunityAccess,
  key: string,
  pageUrl: string,
  now: Date,
): Promise<string | null> {
  const f = await byKey(repo, community, access, key);
  if (!f) return null;
  return icsFor({
    uid: `${occurrenceKey(f.m.id, f.o.n)}@masterclass`,
    title: f.o.title,
    description: `${f.o.description}\n\n${pageUrl}`,
    location: pageUrl,
    startsAt: f.o.startsAt,
    endsAt: f.o.endsAt,
    stamp: now,
  });
}

export async function meetupCommand(repo: Repo, viewer: Viewer, cmd: MeetupCommand, now: Date): Promise<CommandResult> {
  const me = viewer.profile?.id;
  const m = await repo.meetup(cmd.meetupId);
  const community = m && (await repo.product(m.communityId));
  if (!me || !m || !community) return NOT_FOUND;
  const access = await communityAccess(repo, viewer, community, now);
  const f = await visibleOccurrence(repo, community, access, m.id, cmd.occurrence);
  if (!f) return NOT_FOUND;
  if (meetupState(f.o, now) === 'past') return { ok: false, error: 'invalid', message: 'This meetup has ended.' };
  await repo.setRsvp(m.id, f.o.n, me, cmd.on, now);
  return { ok: true };
}
