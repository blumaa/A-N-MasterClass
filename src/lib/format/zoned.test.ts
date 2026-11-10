import { describe, expect, it } from 'vitest';
import { utcToZonedInput, zonedToUtc } from './zoned';

describe('zonedToUtc (datetime-local value in an IANA zone)', () => {
  it('converts winter and summer times', () => {
    expect(zonedToUtc('2026-01-15T18:00', 'Europe/Berlin')).toEqual(new Date('2026-01-15T17:00:00Z'));
    expect(zonedToUtc('2026-07-15T18:00', 'Europe/Berlin')).toEqual(new Date('2026-07-15T16:00:00Z'));
    expect(zonedToUtc('2026-07-15T18:00', 'America/New_York')).toEqual(new Date('2026-07-15T22:00:00Z'));
    expect(zonedToUtc('2026-07-15T18:00', 'UTC')).toEqual(new Date('2026-07-15T18:00:00Z'));
  });

  it('moves a time skipped by spring-forward past the gap; picks the first of a repeated hour', () => {
    expect(zonedToUtc('2026-03-29T02:30', 'Europe/Berlin')).toEqual(new Date('2026-03-29T01:30:00Z'));
    expect(zonedToUtc('2026-10-25T02:30', 'Europe/Berlin')).toEqual(new Date('2026-10-25T00:30:00Z'));
  });

  it('rejects malformed input', () => {
    expect(zonedToUtc('2026-13-01T10:00', 'UTC')).toBeNull();
    expect(zonedToUtc('tomorrow', 'UTC')).toBeNull();
    expect(zonedToUtc('2026-01-01T10:00', 'Mars/Base')).toBeNull();
  });
});

describe('utcToZonedInput', () => {
  it('is the inverse, for prefilling datetime-local inputs', () => {
    expect(utcToZonedInput(new Date('2026-07-15T16:00:00Z'), 'Europe/Berlin')).toBe('2026-07-15T18:00');
    expect(utcToZonedInput(new Date('2026-01-15T00:05:00Z'), 'America/New_York')).toBe('2026-01-14T19:05');
  });
});
