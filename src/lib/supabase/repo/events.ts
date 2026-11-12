// Supabase Repo: points totals, challenges + entries, meetups + occurrence edits + RSVPs.
// Semantics mirror src/lib/data/fake/fakeEventsRepo.ts; constraints come from the SQL schema.
// The points ledger is written by SQL triggers on the source rows; this repo only reads it.
import type { Repo } from '@/lib/data/repo';
import type { Meetup } from '@/lib/data/types';
import { check, defined, unwrap, unwrapMaybe, type RepoCtx } from './context';
import {
  repeatColumns,
  toChallenge,
  toChallengeEntry,
  toMeetup,
  toMeetupOccurrence,
  toMeetupRsvp,
  type MeetupRow,
} from './mapEvents';

export type EventsRepo = Pick<
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

// Everything on meetups except location (column grant hides it from clients).
// One literal: supabase-js parses it for row types (a `+` concat widens it to string).
const MEETUP_COLUMNS =
  'id, community_id, access_group_id, channel_id, title, description, time_zone, starts_at, ends_at, replay_vimeo_id, created_at, repeat_freq, repeat_every, repeat_days, repeat_count, repeat_until';
const PAGE = 1000;

export function createEventsRepo({ db, admin }: RepoCtx): EventsRepo {
  /**
   * Join links for meetups the caller can already see (rows came back through RLS). Read with the
   * secret key because the column is hidden from clients; the opening-window rule for members
   * (meetup_join_url) is left to the feature layer, as the fake repo does.
   */
  async function withLocations(rows: MeetupRow[]): Promise<Meetup[]> {
    if (rows.length === 0) return [];
    const links = unwrap(
      await admin()
        .from('meetups')
        .select('id, location')
        .in(
          'id',
          rows.map((r) => r.id),
        ),
    );
    const byId = new Map(links.map((l) => [l.id, l.location]));
    return rows.map((r) => toMeetup(r, byId.get(r.id) ?? ''));
  }

  async function meetupById(id: string): Promise<Meetup | null> {
    const row = unwrapMaybe(await (await db()).from('meetups').select(MEETUP_COLUMNS).eq('id', id).maybeSingle());
    return row && (await withLocations([row]))[0]!;
  }

  async function mustMeetup(id: string): Promise<Meetup> {
    const m = await meetupById(id);
    if (!m) throw new Error('meetup not found');
    return m;
  }

  return {
    // The ledger's RLS shows the board only where it is visible (sees_leaderboard), so sum client
    // side instead of point_totals(): that function is security definer on auth.uid().
    async pointTotals(communityId, since) {
      const c = await db();
      const sums = new Map<string, number>();
      for (let from = 0; ; from += PAGE) {
        let q = c.from('points_ledger').select('profile_id, points').eq('community_id', communityId);
        if (since) q = q.gte('created_at', since.toISOString());
        const page = unwrap(await q.order('created_at').order('profile_id').order('source_key').range(from, from + PAGE - 1));
        for (const r of page) sums.set(r.profile_id, (sums.get(r.profile_id) ?? 0) + r.points);
        if (page.length < PAGE) break;
      }
      return [...sums]
        .map(([profileId, points]) => ({ profileId, points }))
        .filter((t) => t.points > 0)
        .toSorted((a, b) => b.points - a.points || a.profileId.localeCompare(b.profileId));
    },

    async challenges(communityId) {
      return unwrap(
        await (await db()).from('challenges').select('*').eq('community_id', communityId).order('starts_at', { ascending: false }),
      ).map(toChallenge);
    },
    async challenge(id) {
      const row = unwrapMaybe(await (await db()).from('challenges').select('*').eq('id', id).maybeSingle());
      return row && toChallenge(row);
    },
    async createChallenge(input) {
      const row = unwrap(
        await (await db())
          .from('challenges')
          .insert({
            community_id: input.communityId,
            access_group_id: input.accessGroupId,
            title: input.title,
            description: input.description,
            prize: input.prize,
            starts_at: input.startsAt.toISOString(),
            ends_at: input.endsAt.toISOString(),
            show_before_start: input.showBeforeStart,
          })
          .select('*')
          .single(),
      );
      return toChallenge(row);
    },
    async updateChallenge(id, patch) {
      const row = unwrap(
        await (await db())
          .from('challenges')
          .update(
            defined({
              title: patch.title,
              description: patch.description,
              prize: patch.prize,
              starts_at: patch.startsAt?.toISOString(),
              ends_at: patch.endsAt?.toISOString(),
              show_before_start: patch.showBeforeStart,
            }),
          )
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toChallenge(row);
    },
    // Entries cascade; their ledger rows go with them (trigger).
    async deleteChallenge(id) {
      check(await (await db()).from('challenges').delete().eq('id', id));
    },
    async challengeEntries(challengeId) {
      return unwrap(
        await (await db()).from('challenge_entries').select('*').eq('challenge_id', challengeId).order('created_at'),
      ).map(toChallengeEntry);
    },
    // Window check and the 100-point award are triggers.
    async createChallengeEntry(row) {
      check(
        await (await db())
          .from('challenge_entries')
          .insert({
            challenge_id: row.challengeId,
            profile_id: row.profileId,
            body: row.body,
            created_at: row.createdAt.toISOString(),
          }),
      );
    },
    async deleteChallengeEntry(challengeId, profileId) {
      check(await (await db()).from('challenge_entries').delete().eq('challenge_id', challengeId).eq('profile_id', profileId));
    },

    async meetups(communityId) {
      const rows = unwrap(
        await (await db()).from('meetups').select(MEETUP_COLUMNS).eq('community_id', communityId).order('starts_at'),
      );
      return withLocations(rows);
    },
    meetup: meetupById,
    async createMeetup(input) {
      const row = unwrap(
        await (await db())
          .from('meetups')
          .insert({
            community_id: input.communityId,
            access_group_id: input.accessGroupId,
            channel_id: input.channelId,
            title: input.title,
            description: input.description,
            location: input.location,
            time_zone: input.timeZone,
            starts_at: input.startsAt.toISOString(),
            ends_at: input.endsAt.toISOString(),
            ...repeatColumns(input.repeat),
          })
          .select('id')
          .single(),
      );
      return mustMeetup(row.id);
    },
    async updateMeetup(id, patch) {
      const row = unwrap(
        await (await db())
          .from('meetups')
          .update(
            defined({
              channel_id: patch.channelId,
              title: patch.title,
              description: patch.description,
              location: patch.location,
              time_zone: patch.timeZone,
              starts_at: patch.startsAt?.toISOString(),
              ends_at: patch.endsAt?.toISOString(),
              replay_vimeo_id: patch.replayVimeoId,
              ...(patch.repeat === undefined ? {} : repeatColumns(patch.repeat)),
            }),
          )
          .eq('id', id)
          .select('id')
          .single(),
      );
      return mustMeetup(row.id);
    },
    async deleteMeetup(id) {
      check(await (await db()).from('meetups').delete().eq('id', id));
    },
    async meetupOccurrences(meetupId) {
      return unwrap(
        await (await db()).from('meetup_occurrences').select('*').eq('meetup_id', meetupId).order('occurrence'),
      ).map(toMeetupOccurrence);
    },
    async setMeetupOccurrence(row) {
      check(
        await (await db()).from('meetup_occurrences').upsert(
          {
            meetup_id: row.meetupId,
            occurrence: row.occurrence,
            cancelled: row.cancelled,
            title: row.title,
            description: row.description,
            starts_at: row.startsAt?.toISOString() ?? null,
            ends_at: row.endsAt?.toISOString() ?? null,
            replay_vimeo_id: row.replayVimeoId,
          },
          { onConflict: 'meetup_id,occurrence' },
        ),
      );
    },
    async splitMeetup(meetupId, at) {
      const id = unwrap(await (await db()).rpc('split_meetup', { target_meetup: meetupId, split_at: at }));
      return mustMeetup(id);
    },
    async meetupRsvps(meetupId) {
      return unwrap(
        await (await db()).from('meetup_rsvps').select('*').eq('meetup_id', meetupId).order('occurrence'),
      ).map(toMeetupRsvp);
    },
    async setRsvp(meetupId, occurrence, profileId, on, now) {
      const c = await db();
      if (on) {
        check(
          await c
            .from('meetup_rsvps')
            .upsert(
              { meetup_id: meetupId, occurrence, profile_id: profileId, created_at: now.toISOString() },
              { onConflict: 'meetup_id,occurrence,profile_id', ignoreDuplicates: true },
            ),
        );
      } else {
        check(
          await c
            .from('meetup_rsvps')
            .delete()
            .eq('meetup_id', meetupId)
            .eq('occurrence', occurrence)
            .eq('profile_id', profileId),
        );
      }
    },
  };
}
