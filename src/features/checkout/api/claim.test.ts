import { beforeEach, describe, expect, it } from 'vitest';
import { newClaimToken } from '@/lib/auth/claimToken';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { claimAccount } from './claim';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let token: string;

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  const claim = newClaimToken(NOW);
  token = claim.token;
  await repo.createClaimToken({ tokenHash: claim.hash, spaceId: 's1', profileId: 'u1', expiresAt: claim.expiresAt, usedAt: null });
});

describe('claimAccount', () => {
  it('returns the buyer for a valid link once', async () => {
    expect(await claimAccount(repo, 's1', token, NOW)).toBe('u1');
    expect(await claimAccount(repo, 's1', token, NOW)).toBeNull();
  });

  it('refuses a link of another space without using it up', async () => {
    expect(await claimAccount(repo, 's2', token, NOW)).toBeNull();
    expect(repo.db.claimTokens[0].usedAt).toBeNull();
  });

  it('refuses an expired or unknown link', async () => {
    expect(await claimAccount(repo, 's1', token, new Date(NOW.getTime() + 11 * 86_400_000))).toBeNull();
    expect(await claimAccount(repo, 's1', 'nope', NOW)).toBeNull();
  });
});
