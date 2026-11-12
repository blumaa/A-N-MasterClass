// Absolute origin of the current request, for URLs shown to people outside the app
// (e.g. the PayPal webhook URL). Proxies set x-forwarded-proto; local dev runs plain http.
import { requestHost } from './requestHost';

const LOCAL = /(^|\.)localhost(:\d+)?$/;

export function requestOrigin(host: string, forwardedProto: string | null): string {
  const proto = forwardedProto ?? (LOCAL.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** requestOrigin read straight from request headers (host via requestHost). */
export function headersOrigin(headers: Pick<Headers, 'get'>): string {
  return requestOrigin(requestHost(headers) ?? '', headers.get('x-forwarded-proto'));
}

/**
 * Platform origin seen from a space origin: same protocol and port (dev runs every host on one
 * port), host name = platform host. Used for the fixed OAuth callback (one per platform).
 */
export function platformOrigin(spaceOrigin: string, platformHost: string): string {
  const url = new URL(spaceOrigin);
  url.hostname = platformHost;
  return url.origin;
}

/** Default address of a space (G17): `<slug>.<platform host>`, same protocol and port as the platform origin. */
export function spaceOrigin(platformOrigin: string, slug: string): string {
  const url = new URL(platformOrigin);
  url.hostname = `${slug}.${url.hostname}`;
  return url.origin;
}
