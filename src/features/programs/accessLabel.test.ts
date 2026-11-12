import { describe, expect, it } from 'vitest';
import { accessLabel } from './accessLabel';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('accessLabel', () => {
  it('says nothing for open', () => expect(accessLabel({ kind: 'open' }, NOW)).toBeNull());
  it('counts drip days up', () => {
    expect(accessLabel({ kind: 'drip', opensAt: new Date('2026-11-15T13:00:00Z') }, NOW)).toBe('Opens in 6 days');
    expect(accessLabel({ kind: 'drip', opensAt: new Date('2026-11-10T20:00:00Z') }, NOW)).toBe('Opens tomorrow');
  });
  it('explains locks and missing grants', () => {
    expect(accessLabel({ kind: 'locked', afterStepId: 's' }, NOW)).toMatch(/previous lesson/);
    expect(accessLabel({ kind: 'quiz_locked', quizPartId: 'q' }, NOW)).toBe('Pass the quiz to unlock');
    expect(accessLabel({ kind: 'no_grant' }, NOW)).toMatch(/Enrol/);
  });
});
