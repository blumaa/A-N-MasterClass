// Public checkout URL. Lives in lib so the site feature (offer sections) and the checkout
// feature share one definition without crossing the feature boundary.

/** Kajabi's coupon link parameter: the checkout opens with this coupon applied. */
export const COUPON_PARAM = 'coupon_code';

export const checkoutPath = (offerSlug: string, couponCode?: string): string => {
  const path = `/checkout/${encodeURIComponent(offerSlug)}`;
  return couponCode ? `${path}?${COUPON_PARAM}=${encodeURIComponent(couponCode)}` : path;
};
