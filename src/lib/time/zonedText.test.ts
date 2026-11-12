import { describe, expect, it } from 'vitest';
import { zonedText } from './zonedText';

describe('zonedText', () => {
  const start = new Date('2026-11-11T21:30:00Z');
  const end = new Date('2026-11-11T22:30:00Z');

  it("shows the viewer's zone first and the event's own zone when it reads differently", () => {
    expect(zonedText([start, end], 'Asia/Tokyo', 'Europe/Berlin')).toEqual({
      local: 'Nov 12, 2026, 6:30 AM GMT+9 – Nov 12, 2026, 7:30 AM GMT+9',
      own: 'Nov 11, 2026, 10:30 PM GMT+1 – Nov 11, 2026, 11:30 PM GMT+1',
    });
  });

  it('drops the own line when both zones read the same', () => {
    expect(zonedText([start], 'Europe/Berlin', 'Europe/Berlin')).toEqual({
      local: 'Nov 11, 2026, 10:30 PM GMT+1',
      own: null,
    });
    expect(zonedText([start], 'Europe/Paris', 'Europe/Berlin').own).toBeNull();
  });

  it('uses the own zone when the viewer zone is unknown', () => {
    expect(zonedText([start], null, 'Europe/Berlin')).toEqual({
      local: 'Nov 11, 2026, 10:30 PM GMT+1',
      own: null,
    });
  });
});
