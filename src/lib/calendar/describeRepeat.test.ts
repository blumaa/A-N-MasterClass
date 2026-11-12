import { describe, expect, it } from 'vitest';
import type { Repeat } from '@/lib/data/types';
import { zonedToUtc } from '@/lib/format/zoned';
import { describeRepeat } from './describeRepeat';

const at = (local: string, zone = 'Europe/Berlin') => {
  const startsAt = zonedToUtc(local, zone)!;
  return { startsAt, endsAt: startsAt, timeZone: zone };
};
const r = (o: Partial<Repeat>): Repeat => ({ freq: 'weekly', every: 1, days: [], count: null, until: null, ...o });

describe('describeRepeat', () => {
  it('is null for a one-off', () => {
    expect(describeRepeat({ ...at('2026-11-10T19:00'), repeat: null })).toBeNull();
  });

  it('names the interval, the days in the meetup zone and the end', () => {
    expect(describeRepeat({ ...at('2026-11-10T19:00'), repeat: r({ freq: 'daily' }) })).toBe('Daily');
    expect(describeRepeat({ ...at('2026-11-10T19:00'), repeat: r({ freq: 'daily', every: 3, count: 4 }) })).toBe('Every 3 days, 4 times');
    // 00:30 Tuesday in Tokyo is Monday in UTC: the zone decides the weekday.
    expect(describeRepeat({ ...at('2026-11-10T00:30', 'Asia/Tokyo'), repeat: r({ days: [4] }) })).toBe('Weekly on Tue, Thu');
    expect(describeRepeat({ ...at('2026-11-10T19:00'), repeat: r({ every: 2, until: '2026-12-01' }) })).toBe(
      'Every 2 weeks on Tue, until December 1, 2026',
    );
  });

  it('monthly names the ordinal weekday; a 5th one reads as the last', () => {
    expect(describeRepeat({ ...at('2026-11-19T18:00'), repeat: r({ freq: 'monthly' }) })).toBe('Monthly on the 3rd Thursday');
    expect(describeRepeat({ ...at('2026-10-29T18:00'), repeat: r({ freq: 'monthly', every: 2 }) })).toBe(
      'Every 2 months on the last Thursday',
    );
  });
});
