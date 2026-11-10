// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isValidSlug, RESERVED_SLUGS } from './slug';

describe('isValidSlug', () => {
  it.each(['natasha', 'alexander', 'a', 'kinbaku-berlin', 'a1'])('accepts %s', (s) => {
    expect(isValidSlug(s)).toBe(true);
  });

  it.each(['', 'Natasha', 'bad_slug', '-a', 'a-', 'a.b', 'a'.repeat(64)])('rejects %j', (s) => {
    expect(isValidSlug(s)).toBe(false);
  });

  it('rejects every reserved slug', () => {
    for (const s of RESERVED_SLUGS) expect(isValidSlug(s)).toBe(false);
  });
});
