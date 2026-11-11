import { NextResponse, type NextRequest } from 'next/server';
import { dataSource } from '@/config/dataSource';
import { platformHost } from '@/config/platform';
import { getServiceRepo } from '@/lib/data/getRepo';
import { refreshSession } from '@/lib/supabase/proxySession';
import { createHostLookup } from '@/lib/tenancy/hostLookup';
import { routeHost } from '@/lib/tenancy/routeHost';

// A newly attached domain is live within this long; a detached one stops within it too.
const HOST_CACHE_MS = 60_000;

// Host lookup runs before any user is known: service repo.
const findSlug = createHostLookup((host) => getServiceRepo().spaceSlugByHost(host), { ttlMs: HOST_CACHE_MS });

const keepCookies = (response: NextResponse) => response;

// 1. Refresh the Supabase session (cookies per host, G2). 2. Host -> space rewrite: platform host,
// <slug>.<platform>, or a custom domain from space_domains.
export async function proxy(request: NextRequest) {
  const withSession = dataSource() === 'supabase' ? await refreshSession(request) : keepCookies;

  const route = await routeHost(request.headers.get('host'), request.nextUrl.pathname, platformHost(), findSlug);
  if ('notFound' in route) return withSession(new NextResponse(null, { status: 404 }));

  const url = request.nextUrl.clone();
  url.pathname = route.rewrite;
  // Forward the (possibly refreshed) request cookies to the rewritten route.
  return withSession(NextResponse.rewrite(url, { request: { headers: request.headers } }));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
