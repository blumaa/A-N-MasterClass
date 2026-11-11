// Google Calendar connect, step 3 (G19): the fixed redirect URI registered in Google Cloud.
// Stores the connection and returns the coach to Studio with ?calendar=<outcome>.
import { NextResponse, type NextRequest } from 'next/server';
import { googleConfig, googleRedirectUri } from '@/config/google';
import { finishConnect } from '@/features/coaching/api/googleConnect';
import { getServiceRepo } from '@/lib/data/getRepo';
import { createGoogleClient } from '@/lib/google/calendar';
import { NONCE_COOKIE } from '@/lib/google/nonceCookie';

export async function GET(req: NextRequest) {
  const config = googleConfig();
  if (!config) return new Response(null, { status: 404 });
  const q = req.nextUrl.searchParams;
  const back = await finishConnect(
    getServiceRepo(),
    createGoogleClient(config),
    config.stateSecret,
    googleRedirectUri(req.nextUrl.origin),
    { state: q.get('state'), code: q.get('code'), error: q.get('error'), nonce: req.cookies.get(NONCE_COOKIE)?.value ?? null },
    new Date(),
  );
  if (!back) return new Response('This link has expired or was opened in another browser. Start again from Studio.', { status: 400 });
  const res = NextResponse.redirect(back);
  res.cookies.delete({ name: NONCE_COOKIE, path: '/api/google' });
  return res;
}
