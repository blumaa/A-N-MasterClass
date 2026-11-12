import { describe, expect, it } from 'vitest';
import { stepAccess, type AccessInput } from './access';

const NOW = new Date('2026-11-10T12:00:00Z');
const DAY = 86_400_000;

const base: AccessInput = {
  productStatus: 'published',
  moduleStatus: 'published',
  stepStatus: 'published',
  unlockAfterStepId: null,
  unlockQuizPartId: null,
  releaseAfterDays: null,
  releaseAt: null,
  grantedAt: new Date(NOW.getTime() - 10 * DAY),
  completedStepIds: new Set(),
  passedQuizPartIds: new Set(),
  isEditor: false,
  now: NOW,
};

describe('stepAccess (mirrors can_read_step)', () => {
  it('opens published step for grant holder', () => {
    expect(stepAccess(base)).toEqual({ kind: 'open' });
  });

  it('hides unpublished step, module or product', () => {
    expect(stepAccess({ ...base, stepStatus: 'draft' })).toEqual({ kind: 'hidden' });
    expect(stepAccess({ ...base, moduleStatus: 'draft' })).toEqual({ kind: 'hidden' });
    expect(stepAccess({ ...base, productStatus: 'draft' })).toEqual({ kind: 'hidden' });
  });

  it('refuses without grant', () => {
    expect(stepAccess({ ...base, grantedAt: null })).toEqual({ kind: 'no_grant' });
  });

  it('locks module until the quiz is passed (G26)', () => {
    const locked = { ...base, unlockQuizPartId: 'q1' };
    expect(stepAccess(locked)).toEqual({ kind: 'quiz_locked', quizPartId: 'q1' });
    expect(stepAccess({ ...locked, passedQuizPartIds: new Set(['q1']) })).toEqual({ kind: 'open' });
    expect(stepAccess({ ...locked, isEditor: true })).toEqual({ kind: 'open' });
  });

  it('locks module until unlock step completed (G7)', () => {
    const locked = { ...base, unlockAfterStepId: 's1' };
    expect(stepAccess(locked)).toEqual({ kind: 'locked', afterStepId: 's1' });
    expect(stepAccess({ ...locked, completedStepIds: new Set(['s1']) })).toEqual({ kind: 'open' });
  });

  it('drips by days since grant (G8)', () => {
    expect(stepAccess({ ...base, releaseAfterDays: 5 })).toEqual({ kind: 'open' });
    expect(stepAccess({ ...base, releaseAfterDays: 30 })).toEqual({
      kind: 'drip',
      opensAt: new Date(NOW.getTime() + 20 * DAY),
    });
  });

  it('drips by fixed date; later of both wins', () => {
    const releaseAt = new Date(NOW.getTime() + DAY);
    expect(stepAccess({ ...base, releaseAt })).toEqual({ kind: 'drip', opensAt: releaseAt });
    expect(stepAccess({ ...base, releaseAt, releaseAfterDays: 30 })).toEqual({
      kind: 'drip',
      opensAt: new Date(NOW.getTime() + 20 * DAY),
    });
  });

  it('editor previews everything', () => {
    expect(stepAccess({ ...base, stepStatus: 'draft', grantedAt: null, isEditor: true })).toEqual({ kind: 'open' });
  });
});
