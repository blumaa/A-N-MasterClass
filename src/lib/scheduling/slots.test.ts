import { describe, expect, it } from 'vitest';
import { availableSlots, DEFAULT_RULES, isBookable, type Schedule } from './slots';

const H = 60;
const base: Schedule = {
  timeZone: 'UTC',
  rules: [{ weekday: 1, startMinute: 9 * H, endMinute: 12 * H }], // Monday 9-12
  overrides: [],
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeMin: 0,
  windowDays: 14,
};
// Sunday 2026-11-08 12:00 UTC. Next Monday = 2026-11-09.
const now = new Date('2026-11-08T12:00:00Z');
const iso = (ds: Date[]) => ds.map((d) => d.toISOString());

describe('availableSlots', () => {
  it('steps through weekly windows every 30 minutes, fitting the session', () => {
    const slots = availableSlots(base, { durationMin: 60, busy: [], now });
    expect(iso(slots).slice(0, 5)).toEqual([
      '2026-11-09T09:00:00.000Z',
      '2026-11-09T09:30:00.000Z',
      '2026-11-09T10:00:00.000Z',
      '2026-11-09T10:30:00.000Z',
      '2026-11-09T11:00:00.000Z',
    ]);
    expect(slots).toHaveLength(10); // two Mondays in the 14-day window
  });

  it('reads windows in the coach zone', () => {
    const slots = availableSlots({ ...base, timeZone: 'Europe/Berlin' }, { durationMin: 60, busy: [], now });
    expect(slots[0]!.toISOString()).toBe('2026-11-09T08:00:00.000Z');
  });

  it('honours minimum notice and the booking window', () => {
    const monday9 = new Date('2026-11-09T09:00:00Z');
    const late = availableSlots(base, { durationMin: 60, busy: [], now: monday9 });
    expect(late[0]!.toISOString()).toBe('2026-11-09T09:00:00.000Z');
    const noticed = availableSlots({ ...base, minNoticeMin: 90 }, { durationMin: 60, busy: [], now: monday9 });
    expect(noticed[0]!.toISOString()).toBe('2026-11-09T10:30:00.000Z');
    const short = availableSlots({ ...base, windowDays: 2 }, { durationMin: 60, busy: [], now });
    expect(short).toHaveLength(5);
  });

  it('skips busy time including buffers', () => {
    const busy = [{ start: new Date('2026-11-09T10:00:00Z'), end: new Date('2026-11-09T10:30:00Z') }];
    const plain = availableSlots({ ...base, windowDays: 2 }, { durationMin: 30, busy, now });
    expect(iso(plain)).toEqual([
      '2026-11-09T09:00:00.000Z',
      '2026-11-09T09:30:00.000Z',
      '2026-11-09T10:30:00.000Z',
      '2026-11-09T11:00:00.000Z',
      '2026-11-09T11:30:00.000Z',
    ]);
    const buffered = availableSlots({ ...base, windowDays: 2, bufferBeforeMin: 15, bufferAfterMin: 15 }, { durationMin: 30, busy, now });
    expect(iso(buffered)).toEqual(['2026-11-09T09:00:00.000Z', '2026-11-09T11:00:00.000Z', '2026-11-09T11:30:00.000Z']);
  });

  it('lets a date override replace the weekly rules, or block the day', () => {
    const blocked = availableSlots(
      { ...base, windowDays: 2, overrides: [{ date: '2026-11-09', startMinute: null, endMinute: null }] },
      { durationMin: 60, busy: [], now },
    );
    expect(blocked).toEqual([]);
    const tuesday = availableSlots(
      { ...base, windowDays: 3, overrides: [{ date: '2026-11-10', startMinute: 14 * H, endMinute: 15 * H }] },
      { durationMin: 60, busy: [], now },
    );
    expect(iso(tuesday).at(-1)).toBe('2026-11-10T14:00:00.000Z');
  });

  it('skips the missing hour on a spring-forward day without duplicates', () => {
    // 2027-03-28: Berlin jumps 02:00 -> 03:00.
    const sunday = { weekday: 0, startMinute: 1 * H, endMinute: 4 * H };
    const slots = availableSlots(
      { ...base, timeZone: 'Europe/Berlin', rules: [sunday], windowDays: 1 },
      { durationMin: 30, busy: [], now: new Date('2027-03-27T23:00:00Z') },
    );
    const times = iso(slots);
    expect(new Set(times).size).toBe(times.length);
    expect(times[0]).toBe('2027-03-28T00:00:00.000Z'); // 01:00 CET
  });

  it('defaults to weekdays 9 to 5', () => {
    expect(DEFAULT_RULES.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(DEFAULT_RULES[0]).toMatchObject({ startMinute: 9 * H, endMinute: 17 * H });
  });
});

describe('isBookable', () => {
  it('accepts an offered slot only', () => {
    const args = { durationMin: 60, busy: [], now };
    expect(isBookable(base, { ...args, start: new Date('2026-11-09T09:30:00Z') })).toBe(true);
    expect(isBookable(base, { ...args, start: new Date('2026-11-09T09:10:00Z') })).toBe(false);
    expect(isBookable(base, { ...args, start: new Date('2026-11-09T11:30:00Z') })).toBe(false);
  });
});
