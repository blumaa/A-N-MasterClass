import { describe, expect, it } from 'vitest';
import { failureMessage } from './commandResult';

describe('failureMessage', () => {
  it('uses the caller’s forbidden text, a generic not-found, and the DAL’s invalid text', () => {
    expect(failureMessage({ ok: false, error: 'forbidden' }, 'No.')).toBe('No.');
    expect(failureMessage({ ok: false, error: 'not_found' }, 'No.')).toMatch(/Not found/);
    expect(failureMessage({ ok: false, error: 'invalid', message: 'Bad hex.' }, 'No.')).toBe('Bad hex.');
  });
});
