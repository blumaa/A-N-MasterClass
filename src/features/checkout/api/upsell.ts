// Upsell (G23): after a paid order the thank-you page offers one more offer. "Yes" is a
// second normal checkout (no saved card, so no one-click like Kajabi; see docs/PLAN.md).
import type { Repo } from '@/lib/data/repo';
import type { Currency } from '@/lib/data/types';

export type UpsellOffer = { slug: string; title: string; description: string | null; priceCents: number; currency: Currency };

/** null = nothing to offer: no upsell, not published, or the buyer already holds all of it. */
export async function upsellFor(
  repo: Repo,
  spaceId: string,
  offerSlug: string,
  profileId: string | null,
  now: Date,
): Promise<UpsellOffer | null> {
  const offer = await repo.offerBySlug(spaceId, offerSlug);
  if (!offer?.upsellOfferId) return null;
  const upsell = await repo.offer(offer.upsellOfferId);
  if (!upsell || upsell.status !== 'published') return null;
  if (profileId) {
    const [items, held] = await Promise.all([repo.offerItems(upsell.id), repo.grants(spaceId, profileId, now)]);
    const owned = new Set(held.map((g) => `${g.productId}:${g.accessGroupId}`));
    if (items.length > 0 && items.every((i) => owned.has(`${i.productId}:${i.accessGroupId}`))) return null;
  }
  return { slug: upsell.slug, title: upsell.title, description: upsell.description, priceCents: upsell.priceCents, currency: upsell.currency };
}
