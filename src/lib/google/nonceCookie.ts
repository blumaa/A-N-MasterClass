// Browser binding for the Google OAuth round trip: the connect route sets the state's nonce
// here, the callback compares it, so a state link cannot be completed in another browser.
import { STATE_TTL_MS } from './state';

export const NONCE_COOKIE = 'mc_google_nonce';

export const nonceCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: 'lax' as const,
  path: '/api/google',
  maxAge: STATE_TTL_MS / 1000,
});
