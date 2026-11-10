import { describe, expect, it } from 'vitest';
import { CLAIM_TTL_DAYS, hashClaimToken, newClaimToken } from './claimToken';

describe('claim tokens', () => {
  it('creates a url-safe token, stores only its hash, expires after 10 days', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    const a = newClaimToken(now);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.hash).toBe(hashClaimToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(a.expiresAt).toEqual(new Date('2026-11-20T00:00:00Z'));
    expect(CLAIM_TTL_DAYS).toBe(10);
    expect(newClaimToken(now).token).not.toBe(a.token);
  });
});
