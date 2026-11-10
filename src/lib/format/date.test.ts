import { expect, it } from 'vitest';
import { formatDate } from './date';

it('formats a calendar date in English, UTC', () => {
  expect(formatDate(new Date('2026-11-01T23:30:00Z'))).toBe('November 1, 2026');
});
