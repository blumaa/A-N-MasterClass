// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createState, readState, STATE_TTL_MS } from './state';

const SECRET = 's'.repeat(32);
const NOW = new Date('2026-11-10T12:00:00Z');
const FIELDS = { spaceSlug: 'alexander', profileId: 'p1', returnTo: 'http://alexander.localhost:3000/studio/coaching' };

describe('OAuth state', () => {
  it('round-trips with a fresh nonce', () => {
    const a = readState(createState(FIELDS, SECRET, NOW), SECRET, NOW)!;
    const b = readState(createState(FIELDS, SECRET, NOW), SECRET, NOW)!;
    expect(a).toMatchObject(FIELDS);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('refuses tampering, other secrets, junk and expiry', () => {
    const raw = createState(FIELDS, SECRET, NOW);
    const [payload, sig] = raw.split('.');
    const forged = Buffer.from(JSON.stringify({ ...FIELDS, spaceSlug: 'natasha', nonce: 'n', expiresAt: NOW.getTime() + 1000 })).toString('base64url');
    expect(readState(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
    expect(readState(raw, 't'.repeat(32), NOW)).toBeNull();
    expect(readState('junk', SECRET, NOW)).toBeNull();
    expect(readState(`${payload}.${sig}.x`, SECRET, NOW)).toBeNull();
    expect(readState(raw, SECRET, new Date(NOW.getTime() + STATE_TTL_MS))).toBeNull();
  });
});
