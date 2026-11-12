import { describe, expect, it } from 'vitest';
import type { MeetupOccurrence, Repeat } from '@/lib/data/types';
import { zonedToUtc } from '@/lib/format/zoned';
import {
  lastOccurrence,
  movedSeries,
  nearOccurrences,
  occurrenceKey,
  occurrenceOf,
  occurrenceWindow,
  parseOccurrenceKey,
  type Schedule,
} from './recurrence';

const HOUR = 3_600_000;
const berlin = (local: string) => zonedToUtc(local, 'Europe/Berlin')!;
const repeat = (r: Partial<Repeat>): Repeat => ({ freq: 'weekly', every: 1, days: [], count: null, until: null, ...r });
const series = (start: string, r: Partial<Repeat> | null, zone = 'Europe/Berlin'): Schedule => {
  const startsAt = zonedToUtc(start, zone)!;
  return { startsAt, endsAt: new Date(startsAt.getTime() + HOUR), timeZone: zone, repeat: r && repeat(r) };
};
const start = (s: Schedule, n: number) => occurrenceWindow(s, n)?.startsAt.toISOString() ?? null;

describe('occurrenceWindow', () => {
  it('a one-off meetup has only occurrence 0', () => {
    const s = series('2026-11-10T19:00', null);
    expect(occurrenceWindow(s, 0)).toEqual({ startsAt: s.startsAt, endsAt: s.endsAt });
    expect(occurrenceWindow(s, 1)).toBeNull();
    expect(occurrenceWindow(s, -1)).toBeNull();
  });

  it('keeps 19:00 Berlin across the October and March DST changes', () => {
    const autumn = series('2026-10-20T19:00', { freq: 'weekly' });
    expect(start(autumn, 0)).toBe('2026-10-20T17:00:00.000Z');
    expect(start(autumn, 1)).toBe('2026-10-27T18:00:00.000Z');
    const spring = series('2026-03-24T19:00', { freq: 'weekly' });
    expect(start(spring, 0)).toBe('2026-03-24T18:00:00.000Z');
    expect(start(spring, 1)).toBe('2026-03-31T17:00:00.000Z');
    // Duration stays one hour.
    expect(occurrenceWindow(spring, 1)!.endsAt.getTime() - occurrenceWindow(spring, 1)!.startsAt.getTime()).toBe(HOUR);
  });

  it('weekly on several days, every other week', () => {
    const s = series('2026-11-02T09:00', { freq: 'weekly', every: 2, days: [1, 3] });
    expect([1, 2, 3].map((n) => start(s, n))).toEqual([
      berlin('2026-11-04T09:00').toISOString(),
      berlin('2026-11-16T09:00').toISOString(),
      berlin('2026-11-18T09:00').toISOString(),
    ]);
  });

  it("weekly always counts the start's own weekday", () => {
    const s = series('2026-11-04T09:00', { freq: 'weekly', days: [1] });
    expect(start(s, 1)).toBe(berlin('2026-11-09T09:00').toISOString());
    expect(start(s, 2)).toBe(berlin('2026-11-11T09:00').toISOString());
  });

  it('daily every 3 days, ending after a count', () => {
    const s = series('2026-11-10T08:00', { freq: 'daily', every: 3, count: 3 });
    expect(start(s, 2)).toBe(berlin('2026-11-16T08:00').toISOString());
    expect(start(s, 3)).toBeNull();
  });

  it('monthly on the same ordinal weekday; a 5th one means the last', () => {
    const third = series('2026-11-19T18:00', { freq: 'monthly' });
    expect(start(third, 1)).toBe(berlin('2026-12-17T18:00').toISOString());
    const last = series('2026-10-29T18:00', { freq: 'monthly' });
    expect(start(last, 1)).toBe(berlin('2026-11-26T18:00').toISOString());
    expect(start(last, 2)).toBe(berlin('2026-12-31T18:00').toISOString());
  });

  it('ends on the until date, inclusive, in the meetup zone', () => {
    // 23:30 Berlin is the next day in UTC; until compares the local date.
    const s = series('2026-11-10T23:30', { freq: 'daily', until: '2026-11-12' });
    expect(start(s, 2)).toBe(berlin('2026-11-12T23:30').toISOString());
    expect(start(s, 3)).toBeNull();
  });

  it('matches zonedToUtc inside DST gaps and overlaps', () => {
    const gap = series('2026-03-28T02:30', { freq: 'daily' });
    expect(start(gap, 1)).toBe(berlin('2026-03-29T02:30').toISOString());
    const overlap = series('2026-10-24T02:30', { freq: 'daily' });
    expect(start(overlap, 1)).toBe('2026-10-25T00:30:00.000Z');
  });
});

describe('lastOccurrence', () => {
  it('is 0 for one-offs, count - 1, the last date up to until, or null when endless', () => {
    expect(lastOccurrence(series('2026-11-10T19:00', null))).toBe(0);
    expect(lastOccurrence(series('2026-11-10T19:00', { freq: 'daily', count: 4 }))).toBe(3);
    expect(lastOccurrence(series('2026-11-10T19:00', { freq: 'weekly', until: '2026-12-01' }))).toBe(3);
    expect(lastOccurrence(series('2026-11-10T19:00', { freq: 'weekly' }))).toBeNull();
  });
});

describe('nearOccurrences', () => {
  const weekly = series('2026-01-06T19:00', { freq: 'weekly' });
  const at = (local: string) => berlin(local);

  it('lists a bounded window: the last ended ones and the next ones (live counts as next)', () => {
    expect(nearOccurrences(weekly, at('2026-01-20T19:30'), 2, 3)).toEqual({ past: [1, 0], upcoming: [2, 3, 4] });
    expect(nearOccurrences(weekly, at('2026-01-20T20:30'), 2, 3)).toEqual({ past: [2, 1], upcoming: [3, 4, 5] });
  });

  it('stops at the end of a finished series', () => {
    const s = series('2026-01-06T19:00', { freq: 'weekly', count: 3 });
    expect(nearOccurrences(s, at('2027-01-01T00:00'), 2, 3)).toEqual({ past: [2, 1], upcoming: [] });
    expect(nearOccurrences(s, at('2026-01-01T00:00'), 2, 5)).toEqual({ past: [], upcoming: [0, 1, 2] });
  });

  it('finds the current occurrence of a long daily series quickly', () => {
    const daily = series('2026-01-01T08:00', { freq: 'daily' });
    expect(nearOccurrences(daily, at('2036-01-01T12:00'), 1, 1)).toEqual({ past: [3652], upcoming: [3653] });
  });
});

describe('occurrenceOf', () => {
  const weekly = { ...series('2026-11-03T19:00', { freq: 'weekly' }), title: 'Q&A', description: 'Ask.', replayVimeoId: '9' };
  const edit = (o: Partial<MeetupOccurrence>): MeetupOccurrence => ({
    meetupId: 'm',
    occurrence: 1,
    cancelled: false,
    title: null,
    description: null,
    startsAt: null,
    endsAt: null,
    replayVimeoId: null,
    ...o,
  });

  it('uses the series values, the replay only on occurrence 0', () => {
    expect(occurrenceOf(weekly, 0, undefined)).toMatchObject({ n: 0, title: 'Q&A', replayVimeoId: '9', cancelled: false });
    expect(occurrenceOf(weekly, 1, undefined)).toMatchObject({ n: 1, replayVimeoId: null, startsAt: berlin('2026-11-10T19:00') });
    expect(occurrenceOf(weekly, -1, undefined)).toBeNull();
  });

  it('applies a "this event only" edit', () => {
    const moved = { startsAt: berlin('2026-11-11T19:00'), endsAt: berlin('2026-11-11T20:00') };
    expect(occurrenceOf(weekly, 1, edit({ title: 'Special', replayVimeoId: '7', ...moved }))).toMatchObject({
      title: 'Special',
      description: 'Ask.',
      replayVimeoId: '7',
      ...moved,
    });
    expect(occurrenceOf(weekly, 1, edit({ cancelled: true }))?.cancelled).toBe(true);
  });
});

describe('occurrence keys', () => {
  it('round-trips; occurrence 0 is the bare id', () => {
    expect(occurrenceKey('abc', 0)).toBe('abc');
    expect(occurrenceKey('abc', 4)).toBe('abc_4');
    expect(parseOccurrenceKey('abc')).toEqual({ id: 'abc', n: 0 });
    expect(parseOccurrenceKey('abc_4')).toEqual({ id: 'abc', n: 4 });
    expect(parseOccurrenceKey('abc_x')).toBeNull();
    expect(parseOccurrenceKey('abc_04')).toBeNull();
    expect(parseOccurrenceKey('abc_0')).toBeNull();
  });
});

describe('movedSeries', () => {
  it('moves the whole series by the wall-clock change of one occurrence', () => {
    // Weekly Tue + Thu 19:00; occurrence 3 (Thu 2026-11-12) moves to Fri 2026-11-13 20:00.
    const s = series('2026-11-03T19:00', { freq: 'weekly', days: [2, 4] });
    const moved = movedSeries(s, 3, { startsAt: berlin('2026-11-13T20:00'), endsAt: berlin('2026-11-13T21:30') })!;
    expect(moved.startsAt).toEqual(berlin('2026-11-04T20:00'));
    expect(moved.endsAt.getTime() - moved.startsAt.getTime()).toBe(1.5 * HOUR);
    expect(moved.repeat?.days).toEqual([3, 5]);
    expect(start({ ...s, ...moved }, 3)).toBe(berlin('2026-11-13T20:00').toISOString());
  });

  it('keeps wall-clock time when the occurrence is on the other side of DST', () => {
    const s = series('2026-10-20T19:00', { freq: 'weekly' });
    const moved = movedSeries(s, 2, { startsAt: berlin('2026-11-03T18:00'), endsAt: berlin('2026-11-03T19:00') })!;
    expect(moved.startsAt).toEqual(berlin('2026-10-20T18:00'));
    expect(movedSeries(s, -1, moved)).toBeNull();
  });
});
