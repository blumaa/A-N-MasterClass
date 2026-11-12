// Studio side of challenges and meetups: list them per community with entry/RSVP counts and
// create, edit or delete them. Same gate as the rest of Studio: products.edit + a community
// the viewer reaches as staff. Occurrences of a repeating meetup: ./meetupSessions.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { ChallengePatch, MeetupPatch, NewChallenge, NewMeetup, Repo } from '@/lib/data/repo';
import type { AccessGroup, Challenge, Channel, Meetup } from '@/lib/data/types';
import { meetupSessions, runOccurrenceCommand, type OccurrenceCommand, type StudioSession } from './meetupSessions';
import { editable } from './studio';

export type StudioEvents = {
  groups: AccessGroup[];
  channels: Channel[];
  challenges: (Challenge & { entryCount: number })[];
  meetups: (Meetup & { rsvpCount: number })[];
};

export async function studioEvents(repo: Repo, viewer: Viewer, communityId: string): Promise<StudioEvents | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const community = await editable(repo, viewer, communityId);
  if (!community) return null;
  const [groups, channels, challenges, meetups] = await Promise.all([
    repo.accessGroups(community.id),
    repo.channels(community.id),
    repo.challenges(community.id),
    repo.meetups(community.id),
  ]);
  const [entries, rsvps] = await Promise.all([
    Promise.all(challenges.map((c) => repo.challengeEntries(c.id))),
    Promise.all(meetups.map((m) => repo.meetupRsvps(m.id))),
  ]);
  return {
    groups,
    channels,
    challenges: challenges.map((c, i) => ({ ...c, entryCount: entries[i].length })),
    meetups: meetups.map((m, i) => ({ ...m, rsvpCount: rsvps[i].length })),
  };
}

export type StudioMeetup = { meetup: Meetup; past: StudioSession[]; upcoming: StudioSession[] };

/** One meetup with its occurrences, for the Studio sessions page. */
export async function studioMeetup(repo: Repo, viewer: Viewer, meetupId: string, now: Date): Promise<StudioMeetup | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const meetup = await repo.meetup(meetupId);
  if (!meetup || !(await editable(repo, viewer, meetup.communityId))) return null;
  return { meetup, ...(await meetupSessions(repo, meetup, now)) };
}

export type EventsCommand =
  | ({ op: 'createChallenge' } & Omit<NewChallenge, 'createdAt'>)
  | { op: 'updateChallenge'; challengeId: string; patch: ChallengePatch }
  | { op: 'deleteChallenge'; challengeId: string }
  | ({ op: 'createMeetup' } & Omit<NewMeetup, 'createdAt'>)
  | { op: 'updateMeetup'; meetupId: string; patch: MeetupPatch }
  | { op: 'deleteMeetup'; meetupId: string }
  | OccurrenceCommand;

const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

/** Owning community id of each op; null = target row missing. */
async function targetOf(repo: Repo, c: EventsCommand): Promise<string | null> {
  switch (c.op) {
    case 'createChallenge':
    case 'createMeetup':
      return c.communityId;
    case 'updateChallenge':
    case 'deleteChallenge':
      return (await repo.challenge(c.challengeId))?.communityId ?? null;
    case 'updateMeetup':
    case 'deleteMeetup':
    case 'editOccurrence':
    case 'cancelOccurrence':
      return (await repo.meetup(c.meetupId))?.communityId ?? null;
  }
}

async function run(repo: Repo, c: EventsCommand, now: Date): Promise<string | undefined> {
  switch (c.op) {
    case 'createChallenge': {
      const { op: _op, ...input } = c;
      return (await repo.createChallenge({ ...input, createdAt: now })).id;
    }
    case 'updateChallenge':
      return void (await repo.updateChallenge(c.challengeId, c.patch));
    case 'deleteChallenge':
      return void (await repo.deleteChallenge(c.challengeId));
    case 'createMeetup': {
      const { op: _op, ...input } = c;
      return (await repo.createMeetup({ ...input, createdAt: now })).id;
    }
    case 'updateMeetup':
      return void (await repo.updateMeetup(c.meetupId, c.patch));
    case 'deleteMeetup':
      return void (await repo.deleteMeetup(c.meetupId));
    case 'editOccurrence':
    case 'cancelOccurrence':
      return runOccurrenceCommand(repo, c);
  }
}

export async function editEvents(repo: Repo, viewer: Viewer, c: EventsCommand, now: Date): Promise<CommandResult> {
  if (!viewer.profile || !viewerCan(viewer, 'products.edit')) return FORBIDDEN;
  const communityId = await targetOf(repo, c);
  if (!communityId || !(await editable(repo, viewer, communityId))) return NOT_FOUND;
  try {
    return { ok: true, id: await run(repo, c, now) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
