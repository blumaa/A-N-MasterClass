import { describe, expect, it } from 'vitest';
import { icsFor } from './ics';

describe('icsFor (RFC 5545)', () => {
  it('writes one UTC event with escaped text and CRLF lines', () => {
    const ics = icsFor({
      uid: 'meetup-1@masterclass',
      title: 'Q&A; live, part 1',
      description: 'Line one\nLine two',
      location: 'https://zoom.us/j/1',
      startsAt: new Date('2026-11-12T18:00:00Z'),
      endsAt: new Date('2026-11-12T19:30:00Z'),
      stamp: new Date('2026-11-10T12:00:00Z'),
    });
    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//masterclass//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:meetup-1@masterclass',
      'DTSTAMP:20261110T120000Z',
      'DTSTART:20261112T180000Z',
      'DTEND:20261112T193000Z',
      'SUMMARY:Q&A\\; live\\, part 1',
      'DESCRIPTION:Line one\\nLine two',
      'LOCATION:https://zoom.us/j/1',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('folds lines longer than 75 octets', () => {
    const ics = icsFor({
      uid: 'u',
      title: 'x'.repeat(100),
      description: '',
      location: '',
      startsAt: new Date(0),
      endsAt: new Date(1000),
      stamp: new Date(0),
    });
    const summary = ics.split('\r\n').filter((l) => l.startsWith('SUMMARY') || l.startsWith(' '));
    expect(summary[0]).toHaveLength(75);
    expect(summary[1]).toBe(' ' + 'x'.repeat(100 - 67));
  });
});
