// Absolute origin of the current request, for URLs shown to people outside the app
// (e.g. the PayPal webhook URL). Proxies set x-forwarded-proto; local dev runs plain http.
const LOCAL = /(^|\.)localhost(:\d+)?$/;

export function requestOrigin(host: string, forwardedProto: string | null): string {
  const proto = forwardedProto ?? (LOCAL.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
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
