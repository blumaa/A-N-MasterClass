// Events part of the fake repo: points totals, challenges with entries, meetups with RSVPs.
// Same constraints as supabase/migrations/*_community_gamification_meetups.sql.
import { bodyRangeMessage, ENTRY_MAX } from '../limits';
import { ConstraintError } from '../errors';
import type { Repo } from '../repo';
import type { Challenge, Meetup } from '../types';
import type { Db } from './db';
import { isTimeZone } from '@/lib/format/zoned';

type EventsRepo = Pick<
  Repo,
  | 'pointTotals'
  | 'challenges'
  | 'challenge'
  | 'createChallenge'
  | 'updateChallenge'
  | 'deleteChallenge'
  | 'challengeEntries'
  | 'createChallengeEntry'
  | 'deleteChallengeEntry'
  | 'meetups'
  | 'meetup'
  | 'createMeetup'
  | 'updateMeetup'
  | 'deleteMeetup'
  | 'meetupRsvps'
  | 'setRsvp'
>;

export const DESCRIPTION_MAX = 10_000;
const VIMEO_ID = /^[0-9]+$/;

export function createFakeEventsRepo(db: Db, id: (prefix: string) => string): EventsRepo {
  function must<T>(row: T | undefined, what: string): T {
    if (!row) throw new Error(`${what} not found`);
    return row;
  }

  /** Shared checks of challenges and meetups: title, window, description, group of the community. */
  function checkEvent(row: Pick<Challenge, 'communityId' | 'accessGroupId' | 'title' | 'description' | 'startsAt' | 'endsAt'>): void {
    if (row.title.trim().length === 0) throw new ConstraintError('title required');
    if (row.description.length > DESCRIPTION_MAX) throw new ConstraintError('description too long');
    if (row.endsAt <= row.startsAt) throw new ConstraintError('end must be after start');
    const group = db.accessGroups.find((g) => g.id === row.accessGroupId);
    if (!group || group.communityId !== row.communityId) throw new ConstraintError('group must belong to the community');
  }

  function checkMeetup(row: Meetup): void {
    checkEvent(row);
    if (!/^https:\/\/\S+$/.test(row.location)) throw new ConstraintError('location must be an https link');
    if (!isTimeZone(row.timeZone)) throw new ConstraintError('unknown time zone');
    if (row.replayVimeoId !== null && !VIMEO_ID.test(row.replayVimeoId)) throw new ConstraintError('vimeo id must be digits');
    if (row.channelId !== null) {
      const channel = db.channels.find((c) => c.id === row.channelId);
      if (!channel || channel.communityId !== row.communityId) throw new ConstraintError('channel must belong to the community');
    }
  }

  return {
    async pointTotals(communityId, since) {
      const sums = new Map<string, number>();
      for (const e of db.pointsLedger) {
        if (e.communityId !== communityId || (since && e.createdAt < since)) continue;
        sums.set(e.profileId, (sums.get(e.profileId) ?? 0) + e.points);
      }
      return [...sums]
        .map(([profileId, points]) => ({ profileId, points }))
        .filter((t) => t.points > 0)
        .toSorted((a, b) => b.points - a.points || a.profileId.localeCompare(b.profileId));
    },

    challenges: async (communityId) =>
      db.challenges.filter((c) => c.communityId === communityId).toSorted((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
    challenge: async (cid) => db.challenges.find((c) => c.id === cid) ?? null,
    async createChallenge(input) {
      const row: Challenge = { ...input, id: id('challenge') };
      checkEvent(row);
      db.challenges.push(row);
      return row;
    },
    async updateChallenge(cid, patch) {
      const row = must(db.challenges.find((c) => c.id === cid), 'challenge');
      checkEvent({ ...row, ...patch });
      return Object.assign(row, patch);
    },
    async deleteChallenge(cid) {
      db.challengeEntries = db.challengeEntries.filter((e) => e.challengeId !== cid);
      db.challenges = db.challenges.filter((c) => c.id !== cid);
    },
    challengeEntries: async (cid) =>
      db.challengeEntries.filter((e) => e.challengeId === cid).toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    async createChallengeEntry(row) {
      const challenge = must(db.challenges.find((c) => c.id === row.challengeId), 'challenge');
      if (row.body.trim().length === 0 || row.body.length > ENTRY_MAX) throw new ConstraintError(bodyRangeMessage(ENTRY_MAX));
      if (row.createdAt < challenge.startsAt || row.createdAt > challenge.endsAt) {
        throw new ConstraintError('entry outside the challenge window');
      }
      if (db.challengeEntries.some((e) => e.challengeId === row.challengeId && e.profileId === row.profileId)) {
        throw new ConstraintError('one entry per member');
      }
      db.challengeEntries.push({ ...row });
    },
    async deleteChallengeEntry(cid, profileId) {
      db.challengeEntries = db.challengeEntries.filter((e) => !(e.challengeId === cid && e.profileId === profileId));
    },

    meetups: async (communityId) =>
      db.meetups.filter((m) => m.communityId === communityId).toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    meetup: async (mid) => db.meetups.find((m) => m.id === mid) ?? null,
    async createMeetup(input) {
      const row: Meetup = { ...input, id: id('meetup'), replayVimeoId: null };
      checkMeetup(row);
      db.meetups.push(row);
      return row;
    },
    async updateMeetup(mid, patch) {
      const row = must(db.meetups.find((m) => m.id === mid), 'meetup');
      checkMeetup({ ...row, ...patch });
      return Object.assign(row, patch);
    },
    async deleteMeetup(mid) {
      db.meetupRsvps = db.meetupRsvps.filter((r) => r.meetupId !== mid);
      db.meetups = db.meetups.filter((m) => m.id !== mid);
    },
    meetupRsvps: async (mid) => db.meetupRsvps.filter((r) => r.meetupId === mid),
    async setRsvp(meetupId, profileId, on, now) {
      must(db.meetups.find((m) => m.id === meetupId), 'meetup');
      const exists = db.meetupRsvps.some((r) => r.meetupId === meetupId && r.profileId === profileId);
      if (on && !exists) db.meetupRsvps.push({ meetupId, profileId, createdAt: now });
      if (!on) db.meetupRsvps = db.meetupRsvps.filter((r) => !(r.meetupId === meetupId && r.profileId === profileId));
    },
  };
}
