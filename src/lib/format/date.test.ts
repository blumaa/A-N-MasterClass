import { expect, it } from 'vitest';
import { formatDate, formatDateTime, formatInZone } from './date';

it('formats a calendar date in English, UTC', () => {
  expect(formatDate(new Date('2026-11-01T23:30:00Z'))).toBe('November 1, 2026');
});

it('formats date and time in English, UTC', () => {
  expect(formatDateTime(new Date('2026-11-01T23:30:00Z'))).toBe('Nov 1, 2026, 11:30 PM');
});

it('formats date and time in a named zone with its abbreviation', () => {
  expect(formatInZone(new Date('2026-11-10T18:00:00Z'), 'Europe/Berlin')).toBe('Nov 10, 2026, 7:00 PM GMT+1');
  expect(formatInZone(new Date('2026-11-10T18:00:00Z'), 'UTC')).toBe('Nov 10, 2026, 6:00 PM UTC');
});
