import { describe, expect, it } from 'vitest';
import { claimPath } from './routes';

describe('claimPath', () => {
  it('encodes the token', () => {
    expect(claimPath('a b')).toBe('/claim/a%20b');
  });
});
