// Meetups part of the fake repo: series with repeats, per-occurrence edits and RSVPs.
// Same constraints and triggers as supabase/migrations/*_recurring_meetups.sql.
import { ConstraintError, OCCURRENCE_MISSING } from '../errors';
import type { Repo } from '../repo';
import type { Meetup, MeetupOccurrence } from '../types';
import type { Db } from './db';
import { checkEvent, checkRepeat, DESCRIPTION_MAX, VIMEO_ID } from './fakeEventChecks';
import { occurrenceWindow } from '@/lib/calendar/recurrence';
import { isTimeZone, utcToZonedInput } from '@/lib/format/zoned';

type MeetupsRepo = Pick<
  Repo,
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

/** ISO weekday (1 = Monday) of the meetup start in its own zone. */
function ownWeekday(m: Meetup): number {
  const date = utcToZonedInput(m.startsAt, m.timeZone).slice(0, 10);
  return new Date(`${date}T00:00Z`).getUTCDay() || 7;
}

export function createFakeMeetupsRepo(db: Db, id: (prefix: string) => string): MeetupsRepo {
  function mustMeetup(mid: string): Meetup {
    const row = db.meetups.find((m) => m.id === mid);
    if (!row) throw new Error('meetup not found');
    return row;
  }

  function checkMeetup(row: Meetup): void {
    checkEvent(db, row);
    if (!/^https:\/\/\S+$/.test(row.location)) throw new ConstraintError('location must be an https link');
    if (!isTimeZone(row.timeZone)) throw new ConstraintError('unknown time zone');
    if (row.replayVimeoId !== null && !VIMEO_ID.test(row.replayVimeoId)) throw new ConstraintError('vimeo id must be digits');
    if (row.channelId !== null) {
      const channel = db.channels.find((c) => c.id === row.channelId);
      if (!channel || channel.communityId !== row.communityId) throw new ConstraintError('channel must belong to the community');
    }
    checkRepeat(row.repeat);
  }

  /** meetups_trim: drop edits and RSVPs of occurrences the series no longer has. */
  function trim(m: Meetup): void {
    const keep = (r: { meetupId: string; occurrence: number }) => r.meetupId !== m.id || occurrenceWindow(m, r.occurrence) !== null;
    db.meetupOccurrences = db.meetupOccurrences.filter(keep);
    db.meetupRsvps = db.meetupRsvps.filter(keep);
  }

  const same = (meetupId: string, occurrence: number) => (r: { meetupId: string; occurrence: number }) =>
    r.meetupId === meetupId && r.occurrence === occurrence;

  return {
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
      const row = mustMeetup(mid);
      checkMeetup({ ...row, ...patch });
      Object.assign(row, patch);
      trim(row);
      return row;
    },
    async deleteMeetup(mid) {
      db.meetupRsvps = db.meetupRsvps.filter((r) => r.meetupId !== mid);
      db.meetupOccurrences = db.meetupOccurrences.filter((o) => o.meetupId !== mid);
      db.meetups = db.meetups.filter((m) => m.id !== mid);
    },

    meetupOccurrences: async (mid) =>
      db.meetupOccurrences.filter((o) => o.meetupId === mid).toSorted((a, b) => a.occurrence - b.occurrence),
    async setMeetupOccurrence(row: MeetupOccurrence) {
      const m = mustMeetup(row.meetupId);
      if (occurrenceWindow(m, row.occurrence) === null) throw new ConstraintError(OCCURRENCE_MISSING);
      if (row.title !== null && row.title.trim().length === 0) throw new ConstraintError('title required');
      if (row.description !== null && row.description.length > DESCRIPTION_MAX) throw new ConstraintError('description too long');
      if (row.replayVimeoId !== null && !VIMEO_ID.test(row.replayVimeoId)) throw new ConstraintError('vimeo id must be digits');
      if ((row.startsAt === null) !== (row.endsAt === null) || (row.startsAt && row.endsAt && row.endsAt <= row.startsAt)) {
        throw new ConstraintError('end must be after start');
      }
      db.meetupOccurrences = [...db.meetupOccurrences.filter((o) => !same(row.meetupId, row.occurrence)(o)), { ...row }];
      if (row.cancelled) db.meetupRsvps = db.meetupRsvps.filter((r) => !same(row.meetupId, row.occurrence)(r));
    },
    async splitMeetup(mid, at) {
      const m = mustMeetup(mid);
      const start = at >= 1 ? occurrenceWindow(m, at) : null;
      if (!start || !m.repeat) throw new ConstraintError(OCCURRENCE_MISSING);
      const r = m.repeat;
      const days = r.freq === 'weekly' ? [...new Set([...r.days, ownWeekday(m)])].toSorted((a, b) => a - b) : [];
      const next: Meetup = {
        ...m,
        id: id('meetup'),
        startsAt: start.startsAt,
        endsAt: start.endsAt,
        replayVimeoId: null,
        repeat: { ...r, days, count: r.count === null ? null : r.count - at },
      };
      db.meetups.push(next);
      const move = <T extends { meetupId: string; occurrence: number }>(rows: T[]) =>
        rows.map((x) => (x.meetupId === mid && x.occurrence >= at ? { ...x, meetupId: next.id, occurrence: x.occurrence - at } : x));
      db.meetupOccurrences = move(db.meetupOccurrences);
      db.meetupRsvps = move(db.meetupRsvps);
      m.repeat = { ...r, count: at, until: null };
      return next;
    },

    meetupRsvps: async (mid) =>
      db.meetupRsvps.filter((r) => r.meetupId === mid).toSorted((a, b) => a.occurrence - b.occurrence),
    async setRsvp(meetupId, occurrence, profileId, on, now) {
      const m = mustMeetup(meetupId);
      const mine = (r: { meetupId: string; occurrence: number; profileId: string }) =>
        same(meetupId, occurrence)(r) && r.profileId === profileId;
      if (!on) {
        db.meetupRsvps = db.meetupRsvps.filter((r) => !mine(r));
        return;
      }
      // RLS meetup_rsvps_insert: the occurrence must exist and not be cancelled.
      const cancelled = db.meetupOccurrences.some((o) => same(meetupId, occurrence)(o) && o.cancelled);
      if (occurrenceWindow(m, occurrence) === null || cancelled) throw new Error(OCCURRENCE_MISSING);
      if (!db.meetupRsvps.some(mine)) db.meetupRsvps.push({ meetupId, occurrence, profileId, createdAt: now });
    },
  };
}
