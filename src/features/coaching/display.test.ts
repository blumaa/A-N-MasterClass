import { describe, expect, it } from 'vitest';
import { clockLabel, slotDays, WEEKDAY_NAMES } from './display';

describe('clockLabel', () => {
  it('renders minutes after midnight as HH:MM', () => {
    expect(clockLabel(0)).toBe('00:00');
    expect(clockLabel(9 * 60 + 5)).toBe('09:05');
    expect(clockLabel(1440)).toBe('24:00');
  });
});

describe('slotDays', () => {
  it('groups slots by local day in the coach zone, keeping the UTC instant', () => {
    const slots = ['2026-11-11T08:00:00Z', '2026-11-11T22:30:00Z', '2026-11-12T08:00:00Z'].map((s) => new Date(s));
    const days = slotDays(slots, 'Europe/Berlin');
    // 22:30 UTC = 23:30 Berlin, still Wednesday.
    expect(days.map((d) => d.label)).toEqual(['Wed, Nov 11', 'Thu, Nov 12']);
    expect(days[0]!.slots).toEqual([
      { iso: '2026-11-11T08:00:00.000Z', time: '09:00' },
      { iso: '2026-11-11T22:30:00.000Z', time: '23:30' },
    ]);
  });
});

describe('WEEKDAY_NAMES', () => {
  it('starts on Sunday like Date.getDay', () => {
    expect(WEEKDAY_NAMES[0]).toBe('Sunday');
    expect(WEEKDAY_NAMES[1]).toBe('Monday');
  });
});
