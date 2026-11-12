// Checkout URLs (SSOT for links, redirects and the claim email).
/** welcome = paid by a new buyer who is now signed in and should set a password (G4). */
export type PaidStatus = 'paid' | 'pending' | 'welcome';

import { checkoutPath } from '@/lib/commerce/paths';

export { checkoutPath };

export const thanksPath = (offerSlug: string, status: PaidStatus): string => `${checkoutPath(offerSlug)}/thanks?status=${status}`;

export const studioOffersHref = '/studio/offers';
export const studioOfferHref = (offerId: string): string => `${studioOffersHref}/${encodeURIComponent(offerId)}`;
export const studioCouponsHref = '/studio/coupons';
export const studioCouponHref = (couponId: string): string => `${studioCouponsHref}/${encodeURIComponent(couponId)}`;
export const studioPaymentsHref = '/studio/payments';
export const studioCustomersHref = '/studio/customers';
export const contactsCsvHref = `${studioCustomersHref}/contacts.csv`;

/** PayPal webhook URL path for a space (G28); matches app/api/payments/paypal/[space]. */
export const paypalWebhookPath = (spaceSlug: string): string => `/api/payments/paypal/${encodeURIComponent(spaceSlug)}`;
