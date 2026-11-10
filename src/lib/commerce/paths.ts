// Public checkout URL. Lives in lib so the site feature (offer sections) and the checkout
// feature share one definition without crossing the feature boundary.
export const checkoutPath = (offerSlug: string): string => `/checkout/${encodeURIComponent(offerSlug)}`;
