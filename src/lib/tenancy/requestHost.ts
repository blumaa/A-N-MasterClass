// Host the visitor asked for. SSOT for every host read (proxy, actions, absolute URLs).
// x-forwarded-host first: Vercel sets it, and Next sets it before re-fetching a server-action
// redirect from its own origin (localhost in dev), where fetch replaces `host`.
type HeaderReader = Pick<Headers, 'get'>;

export function requestHost(headers: HeaderReader): string | null {
  const forwarded = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwarded || headers.get('host');
}
