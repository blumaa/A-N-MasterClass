// Studio browser paths (host-relative). SSOT for studio links.
export const studioHref = '/studio';
export const studioProgramHref = (program: string): string => `/studio/programs/${program}`;
export const studioStepHref = (program: string, step: string): string => `/studio/programs/${program}/steps/${step}`;
export const studioBrandingHref = '/studio/branding';
