// Buyer onboarding shared by order fulfilment and subscription activation (G4, G5):
// account, space profile, grants, contact and the claim link for a new account.
import { newClaimToken } from '@/lib/auth/claimToken';
import { grantIsActive } from '@/lib/data/grants';
import type { Repo } from '@/lib/data/repo';

export type BuyerInput = { spaceId: string; email: string; marketingConsent: boolean; createdAt: Date };

/** The buyer's account (created when new) and their profile in the space. */
export async function buyerProfile(
  repo: Repo,
  spaceId: string,
  email: string,
): Promise<{ profileId: string; isNew: boolean }> {
  const existing = await repo.profileByEmail(email);
  const profile = existing ?? (await repo.createProfile(email));
  await repo.ensureSpaceProfile({ spaceId, profileId: profile.id, displayName: email.split('@')[0] });
  return { profileId: profile.id, isNew: !existing };
}

/**
 * Grants every product of the offers, once per product + access group: holding the default
 * group does not cover a VIP group. A live grant is kept. An expired grant that is still
 * active (subscription cancelled at period end) is revoked first, as fulfil_order does in SQL.
 * A purchase replaces a subscription grant with a permanent one, so a later cancel keeps it.
 */
export async function giveGrants(
  repo: Repo,
  profileId: string,
  offerIds: readonly string[],
  link: { orderId: string } | { subscriptionId: string },
  now: Date,
): Promise<void> {
  const items = (await Promise.all([...new Set(offerIds)].map((id) => repo.offerItems(id)))).flat();
  const done = new Set<string>();
  for (const { productId, accessGroupId } of items) {
    const key = `${productId}:${accessGroupId}`;
    if (done.has(key)) continue;
    done.add(key);
    const held = (await repo.grantsForProduct(productId)).filter(
      (g) => g.profileId === profileId && g.accessGroupId === accessGroupId && g.status === 'active',
    );
    const purchase = 'orderId' in link;
    const keep = held.some((g) => grantIsActive(g, now) && !(purchase && g.subscriptionId !== null));
    if (keep) continue;
    for (const g of held) await repo.revokeGrant(g.id);
    await repo.createGrant({ productId, profileId, source: 'purchase', accessGroupId, ...link });
  }
}

/** Contact row (with consent when given) and, for a new account, the claim link token. */
export async function finishBuyer(
  repo: Repo,
  buyer: BuyerInput,
  profileId: string,
  isNew: boolean,
  now: Date,
): Promise<string | null> {
  await repo.upsertContact({
    spaceId: buyer.spaceId,
    email: buyer.email,
    profileId,
    consent: buyer.marketingConsent ? { source: 'checkout', at: buyer.createdAt } : null,
  });
  if (!isNew) return null;
  const claim = newClaimToken(now);
  await repo.createClaimToken({
    tokenHash: claim.hash,
    spaceId: buyer.spaceId,
    profileId,
    expiresAt: claim.expiresAt,
    usedAt: null,
  });
  return claim.token;
}
