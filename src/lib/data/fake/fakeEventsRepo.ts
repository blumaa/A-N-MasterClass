// Events part of the fake repo: points totals, challenges with entries, meetups (fakeMeetups.ts).
// Same constraints as supabase/migrations/*_community_gamification_meetups.sql.
import { bodyRangeMessage, ENTRY_MAX } from '../limits';
import { ConstraintError } from '../errors';
import type { Repo } from '../repo';
import type { Challenge } from '../types';
import type { Db } from './db';
import { checkEvent } from './fakeEventChecks';
import { createFakeMeetupsRepo } from './fakeMeetups';

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
  | 'meetupOccurrences'
  | 'setMeetupOccurrence'
  | 'splitMeetup'
  | 'meetupRsvps'
  | 'setRsvp'
>;

export function createFakeEventsRepo(db: Db, id: (prefix: string) => string): EventsRepo {
  function must<T>(row: T | undefined, what: string): T {
    if (!row) throw new Error(`${what} not found`);
    return row;
  }
  const checkChallenge = (row: Challenge) => checkEvent(db, row);

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
      checkChallenge(row);
      db.challenges.push(row);
      return row;
    },
    async updateChallenge(cid, patch) {
      const row = must(db.challenges.find((c) => c.id === cid), 'challenge');
      checkChallenge({ ...row, ...patch });
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
    ...createFakeMeetupsRepo(db, id),
  };
}
