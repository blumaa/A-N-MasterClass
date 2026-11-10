// Google Calendar connect, step 2 (G19): on the platform host, binds the signed state to this
// browser (nonce cookie) and sends the coach to Google's consent screen. Step 1 is the Studio
// action that signed the state; step 3 is /api/google/callback.
import { NextResponse, type NextRequest } from 'next/server';
import { googleConfig, googleRedirectUri } from '@/config/google';
import { googleAuthUrl } from '@/lib/google/calendar';
import { NONCE_COOKIE, nonceCookieOptions } from '@/lib/google/nonceCookie';
import { readState } from '@/lib/google/state';

export function GET(req: NextRequest) {
  const config = googleConfig();
  if (!config) return new Response(null, { status: 404 });
  const raw = req.nextUrl.searchParams.get('state');
  const state = raw ? readState(raw, config.stateSecret, new Date()) : null;
  if (!raw || !state) return new Response('This link has expired. Start again from Studio.', { status: 400 });
  const res = NextResponse.redirect(googleAuthUrl(config, googleRedirectUri(req.nextUrl.origin), raw));
  res.cookies.set(NONCE_COOKIE, state.nonce, nonceCookieOptions(req.nextUrl.protocol === 'https:'));
  return res;
}
