// Request-scoped loader for the checkout page: generateMetadata and the page share one read.
import 'server-only';
import { cache } from 'react';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { spaceProvider } from '@/lib/payments/spaceProvider';
import { checkoutOffer, type CheckoutOffer } from './checkout';

export type LoadedCheckout = {
  offer: CheckoutOffer;
  locale: string;
  /** Paid offer and no payment provider configured: nothing to pay with. */
  payable: boolean;
  clientId: string | null;
};

export const loadCheckout = cache(async (spaceSlug: string, offerSlug: string): Promise<LoadedCheckout | null> => {
  const viewer = await currentViewer(spaceSlug);
  if (!viewer) return null;
  const offer = await checkoutOffer(getRepo(), viewer.space.id, offerSlug);
  if (!offer) return null;
  if (offer.priceCents === 0) return { offer, locale: viewer.space.locale, payable: true, clientId: null };
  const choice = await spaceProvider(viewer.space.id);
  return choice.kind === 'ready'
    ? { offer, locale: viewer.space.locale, payable: true, clientId: choice.clientId }
    : { offer, locale: viewer.space.locale, payable: false, clientId: null };
});
