// Checkout URLs (SSOT for links, redirects and the claim email).
export type PaidStatus = 'paid' | 'pending';

import { checkoutPath } from '@/lib/commerce/paths';

export { checkoutPath };

export const thanksPath = (offerSlug: string, status: PaidStatus): string => `${checkoutPath(offerSlug)}/thanks?status=${status}`;

export const claimPath = (token: string): string => `/claim/${encodeURIComponent(token)}`;

export const studioOffersHref = '/studio/offers';
export const studioOfferHref = (offerId: string): string => `${studioOffersHref}/${encodeURIComponent(offerId)}`;
export const studioPaymentsHref = '/studio/payments';
export const studioCustomersHref = '/studio/customers';
export const contactsCsvHref = `${studioCustomersHref}/contacts.csv`;

/** PayPal webhook URL path for a space (G28); matches app/api/payments/paypal/[space]. */
export const paypalWebhookPath = (spaceSlug: string): string => `/api/payments/paypal/${encodeURIComponent(spaceSlug)}`;
