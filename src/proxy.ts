import { NextResponse, type NextRequest } from 'next/server';
import { dataSource } from '@/config/dataSource';
import { platformHost } from '@/config/platform';
import { refreshSession } from '@/lib/supabase/proxySession';
import { findSpaceSlug } from '@/lib/tenancy/findSpaceSlug';
import { requestHost } from '@/lib/tenancy/requestHost';
import { routeHost } from '@/lib/tenancy/routeHost';

const keepCookies = (response: NextResponse) => response;

// 1. Refresh the Supabase session (cookies per host, G2). 2. Host -> space rewrite: platform host,
// <slug>.<platform>, or a custom domain from space_domains.
export async function proxy(request: NextRequest) {
  const withSession = dataSource() === 'supabase' ? await refreshSession(request) : keepCookies;

  const route = await routeHost(requestHost(request.headers), request.nextUrl.pathname, platformHost(), findSpaceSlug);
  if ('notFound' in route) return withSession(new NextResponse(null, { status: 404 }));

  const url = request.nextUrl.clone();
  url.pathname = route.rewrite;
  // Forward the (possibly refreshed) request cookies to the rewritten route.
  return withSession(NextResponse.rewrite(url, { request: { headers: request.headers } }));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
