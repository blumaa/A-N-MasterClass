/**
 * The seven values a space brand owns. SSOT for brand.css (`--brand-<name>`) and the
 * per-space runtime theme, which sets only these on :root.
 */
export const BRAND_INPUTS = [
  'accent', // single accent
  'accent-soft', // accent's pale fill
  'page', // page background
  'card', // card surface, lightest value
  'hairline', // lightest grey: borders, sunken fills
  'mid', // mid grey
  'ink', // darkest value: text, primary action
] as const;

export type BrandInput = (typeof BRAND_INPUTS)[number];
