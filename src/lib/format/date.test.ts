import { expect, it } from 'vitest';
import { formatDate, formatDateTime } from './date';

it('formats a calendar date in English, UTC', () => {
  expect(formatDate(new Date('2026-11-01T23:30:00Z'))).toBe('November 1, 2026');
});

it('formats date and time in English, UTC', () => {
  expect(formatDateTime(new Date('2026-11-01T23:30:00Z'))).toBe('Nov 1, 2026, 11:30 PM');
});
