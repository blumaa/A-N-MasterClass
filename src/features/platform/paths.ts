// Platform host routes (proxy rewrites them under /platform).
export const platformHomeHref = '/';
export const platformSignInHref = '/login';
export const platformSpaceHref = (slug: string): string => `/spaces/${encodeURIComponent(slug)}`;
