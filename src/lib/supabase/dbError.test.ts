import { describe, expect, it } from 'vitest';
import { ConstraintError } from '@/lib/data/errors';
import { toDataError } from './dbError';

const pg = (code: string, message = 'boom') => ({ code, message, details: '', hint: '' });

describe('toDataError', () => {
  it.each(['23505', '23514', '23503', '23P01', '23502'])('maps integrity violation %s to ConstraintError', (code) => {
    expect(toDataError(pg(code, 'violates something'))).toBeInstanceOf(ConstraintError);
  });

  it.each([
    ['23505', 'duplicate key value violates unique constraint "offers_slug_taken"', /^slug taken$/],
    ['23505', 'duplicate key value violates unique constraint "products_space_id_slug_key"', /^slug taken$/],
    ['23514', 'new row for relation "offers" violates check constraint "offers_slug_format"', /^invalid slug$/],
    ['23514', 'new row for relation "offers" violates check constraint "offers_price"', /^price out of range$/],
    [
      '23503',
      'update or delete on table "offers" violates foreign key constraint "orders_offer_id_fkey" on table "orders"',
      /^offer has orders$/,
    ],
    [
      '23503',
      'update or delete on table "access_groups" violates foreign key constraint "meetups_access_group_id_fkey" on table "meetups"',
      /^group in use$/,
    ],
    ['23514', 'new row for relation "posts" violates check constraint "posts_body_check"', /^body must be 1\.\.10000 chars$/],
    ['23P01', 'conflicting key value violates exclusion constraint "coaching_sessions_no_overlap"', /^overlaps another session$/],
    ['23514', 'new row for relation "modules" violates check constraint "modules_title_check"', /^title required$/],
    ['23505', 'duplicate key value violates unique constraint "reports_once"', /^already reported$/],
    ['23514', 'new row for relation "reports" violates check constraint "reports_reason"', /^reason must be 1\.\.500 chars$/],
    ['23503', 'new row for relation "reports" violates constraint "reports_target_missing"', /^content not found$/],
  ])('gives %s on %s the same text as the fake repo', (code, message, expected) => {
    expect(toDataError(pg(code, message)).message).toMatch(expected);
  });

  it('keeps the database text when no constraint name is known (custom RAISE in RPCs)', () => {
    expect(toDataError(pg('23514', 'no sessions left')).message).toBe('no sessions left');
    expect(toDataError(pg('23514', 'violates check constraint "brand_new_check"')).message).toMatch(/brand_new_check/);
  });

  it('keeps anything else a plain Error with the code', () => {
    const err = toDataError(pg('42501', 'permission denied'));
    expect(err).not.toBeInstanceOf(ConstraintError);
    expect(err.message).toMatch(/42501.*permission denied/);
  });
});
