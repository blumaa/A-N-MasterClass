import { describe, expect, it } from 'vitest';
import { clockLabel, slotDays, WEEKDAY_NAMES, zonedText } from './display';

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

describe('slotDays in the client zone', () => {
  const at = (iso: string) => new Date(iso);
  const view = (slots: Date[], zone: string) => slotDays(slots, zone).map((d) => [d.label, d.slots.map((s) => s.time)]);

  it('late evening in Berlin is the next morning in Tokyo, so days regroup', () => {
    // Wed 22:30 Berlin and Thu 09:00 Berlin.
    const slots = [at('2026-11-11T21:30:00Z'), at('2026-11-12T08:00:00Z')];
    expect(view(slots, 'Europe/Berlin')).toEqual([
      ['Wed, Nov 11', ['22:30']],
      ['Thu, Nov 12', ['09:00']],
    ]);
    expect(view(slots, 'Asia/Tokyo')).toEqual([['Thu, Nov 12', ['06:30', '17:00']]]);
  });

  it('follows each zone across DST: Berlin changes on Oct 25, New York on Nov 1, Tokyo never', () => {
    // 19:00 Berlin on Sat Oct 24 (summer time), Mon Oct 26 and Mon Nov 2 (winter time).
    const slots = [at('2026-10-24T17:00:00Z'), at('2026-10-26T18:00:00Z'), at('2026-11-02T18:00:00Z')];
    expect(view(slots, 'Europe/Berlin').map(([, t]) => t)).toEqual([['19:00'], ['19:00'], ['19:00']]);
    expect(view(slots, 'America/New_York')).toEqual([
      ['Sat, Oct 24', ['13:00']],
      ['Mon, Oct 26', ['14:00']],
      ['Mon, Nov 2', ['13:00']],
    ]);
    expect(view(slots, 'Asia/Tokyo')).toEqual([
      ['Sun, Oct 25', ['02:00']],
      ['Tue, Oct 27', ['03:00']],
      ['Tue, Nov 3', ['03:00']],
    ]);
  });
});

describe('zonedText', () => {
  const start = new Date('2026-11-11T21:30:00Z');
  const end = new Date('2026-11-11T22:30:00Z');

  it("shows the client's zone first and the coach's when it reads differently", () => {
    expect(zonedText([start, end], 'Asia/Tokyo', 'Europe/Berlin')).toEqual({
      local: 'Nov 12, 2026, 6:30 AM GMT+9 – Nov 12, 2026, 7:30 AM GMT+9',
      coach: 'Nov 11, 2026, 10:30 PM GMT+1 – Nov 11, 2026, 11:30 PM GMT+1',
    });
  });

  it('drops the coach line when both zones read the same', () => {
    expect(zonedText([start], 'Europe/Berlin', 'Europe/Berlin')).toEqual({ local: 'Nov 11, 2026, 10:30 PM GMT+1', coach: null });
    expect(zonedText([start], 'Europe/Paris', 'Europe/Berlin').coach).toBeNull();
  });
});

describe('WEEKDAY_NAMES', () => {
  it('starts on Sunday like Date.getDay', () => {
    expect(WEEKDAY_NAMES[0]).toBe('Sunday');
    expect(WEEKDAY_NAMES[1]).toBe('Monday');
  });
});
