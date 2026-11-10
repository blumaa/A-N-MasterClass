// Claim link (G4): a new buyer opens the 10-day link from the receipt to get into their account.
import { hashClaimToken } from '@/lib/auth/claimToken';
import type { Repo } from '@/lib/data/repo';

/** Profile id the link signs in, or null. A link only works on the space that issued it. */
export async function claimAccount(repo: Repo, spaceId: string, token: string, now: Date): Promise<string | null> {
  return (await repo.consumeClaimToken(spaceId, hashClaimToken(token), now))?.profileId ?? null;
}
