// Signed OAuth `state` (CSRF + context). The connect flow starts on a space host and returns on
// the platform host, so the state carries who connects which space and where to go back,
// HMAC-signed with OAUTH_STATE_SECRET, valid STATE_TTL_MS. `nonce` is also set as a cookie on
// the platform host and compared in the callback, binding the flow to one browser.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const STATE_TTL_MS = 10 * 60_000;

export type OAuthState = { spaceSlug: string; profileId: string; returnTo: string; nonce: string; expiresAt: number };

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function createState(fields: Omit<OAuthState, 'nonce' | 'expiresAt'>, secret: string, now: Date): string {
  const state: OAuthState = { ...fields, nonce: randomBytes(16).toString('base64url'), expiresAt: now.getTime() + STATE_TTL_MS };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** The state, or null when tampered, malformed or expired. */
export function readState(raw: string, secret: string, now: Date): OAuthState | null {
  const [payload, sig, extra] = raw.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
    return typeof s.expiresAt === 'number' && s.expiresAt > now.getTime() ? s : null;
  } catch {
    return null;
  }
}
