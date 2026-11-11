// Host-relative browser paths that more than one feature links to (the proxy adds the space
// segment). Feature-only paths stay in that feature's paths.ts.
export const libraryHref = '/library';
export const signInHref = '/login';
export const devSignInHref = '/dev/login';
export const setPasswordHref = '/account/password';
/** One-time claim link (G4): signs the owner of the token in on its space. */
export const claimPath = (token: string): string => `/claim/${encodeURIComponent(token)}`;
