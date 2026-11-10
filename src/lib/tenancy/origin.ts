// Absolute origin of the current request, for URLs shown to people outside the app
// (e.g. the PayPal webhook URL). Proxies set x-forwarded-proto; local dev runs plain http.
const LOCAL = /(^|\.)localhost(:\d+)?$/;

export function requestOrigin(host: string, forwardedProto: string | null): string {
  const proto = forwardedProto ?? (LOCAL.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}
