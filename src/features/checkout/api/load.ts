// Request-scoped loader for the checkout page: generateMetadata and the page share one read.
import 'server-only';
import { cache } from 'react';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { spaceProvider } from '@/lib/payments/spaceProvider';
import { checkoutOffer, type CheckoutOffer } from './checkout';

export type LoadedCheckout = {
  spaceId: string;
  offer: CheckoutOffer;
  locale: string;
  /** Paid offer and no payment provider configured: nothing to pay with. */
  payable: boolean;
  clientId: string | null;
  /** Show the coupon box: a one-time offer with an active coupon (G23; none on recurring, G5). */
  couponField: boolean;
};

export const loadCheckout = cache(async (spaceSlug: string, offerSlug: string): Promise<LoadedCheckout | null> => {
  const viewer = await currentViewer(spaceSlug);
  if (!viewer) return null;
  const repo = getRepo();
  const offer = await checkoutOffer(repo, viewer.space.id, offerSlug);
  if (!offer) return null;
  const base = {
    spaceId: viewer.space.id,
    offer,
    locale: viewer.space.locale,
    couponField: offer.kind === 'one_time' && (await repo.hasActiveCoupon(offer.id, new Date())),
  };
  if (offer.priceCents === 0 && !offer.bump) return { ...base, payable: true, clientId: null };
  const choice = await spaceProvider(viewer.space.id);
  return choice.kind === 'ready' ? { ...base, payable: true, clientId: choice.clientId } : { ...base, payable: false, clientId: null };
});
