import { describe, expect, it } from 'vitest';
import { ConstraintError } from '@/lib/data/errors';
import { toDataError } from './dbError';

const pg = (code: string, message = 'boom') => ({ code, message, details: '', hint: '' });

describe('toDataError', () => {
  it.each(['23505', '23514', '23503', '23P01', '23502'])('maps integrity violation %s to ConstraintError', (code) => {
    const err = toDataError(pg(code, 'duplicate key value violates unique constraint "products_slug"'));
    expect(err).toBeInstanceOf(ConstraintError);
    expect(err.message).toMatch(/products_slug/);
  });

  it('keeps anything else a plain Error with the code', () => {
    const err = toDataError(pg('42501', 'permission denied'));
    expect(err).not.toBeInstanceOf(ConstraintError);
    expect(err.message).toMatch(/42501.*permission denied/);
  });
});
