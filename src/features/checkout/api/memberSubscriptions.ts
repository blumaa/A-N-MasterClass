// Member account DAL: the signed-in member's subscriptions (G5). Caller passes the viewer's
// own profile. RLS hides unpublished offers from members, so their title falls back.
import type { Repo } from '@/lib/data/repo';
import type { Offer } from '@/lib/data/types';
import { subscriptionRows, type SubscriptionRow } from './subscriptionRows';

const FALLBACK_TITLE = 'Subscription';

export async function memberSubscriptions(repo: Repo, spaceId: string, profileId: string): Promise<SubscriptionRow[]> {
  const subs = await repo.subscriptionsForProfile(spaceId, profileId);
  const offerIds = [...new Set(subs.map((s) => s.offerId))];
  const offers = (await Promise.all(offerIds.map((id) => repo.offer(id)))).filter((o): o is Offer => o !== null);
  return subscriptionRows(subs, offers).map((r) => ({ ...r, offerTitle: r.offerTitle || FALLBACK_TITLE }));
}
