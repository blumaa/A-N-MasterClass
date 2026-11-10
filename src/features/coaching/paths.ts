// Browser paths (host-relative; the proxy adds the space segment). SSOT for coaching links.
export const coachingHref = (product: string): string => `/coaching/${product}`;
export const sessionHref = (product: string, session: string): string => `${coachingHref(product)}/sessions/${session}`;
export const sessionIcsHref = (product: string, session: string): string => `${sessionHref(product, session)}/session.ics`;
export const studioCoachingHref = '/studio/coaching';
export const studioSessionHref = (session: string): string => `${studioCoachingHref}/sessions/${session}`;
/** Platform-host route that starts the Google consent round trip. */
export const googleConnectPath = '/api/google/connect';
