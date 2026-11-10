import { NextResponse, type NextRequest } from 'next/server';
import { platformHost } from '@/config/platform';
import { getRepo } from '@/lib/data/getRepo';
import { createHostLookup } from '@/lib/tenancy/hostLookup';
import { routeHost } from '@/lib/tenancy/routeHost';

// A newly attached domain is live within this long; a detached one stops within it too.
const HOST_CACHE_MS = 60_000;

const findSlug = createHostLookup((host) => getRepo().spaceSlugByHost(host), { ttlMs: HOST_CACHE_MS });

// Host -> space rewrite: platform host, <slug>.<platform>, or a custom domain from space_domains.
export async function proxy(request: NextRequest) {
  const route = await routeHost(request.headers.get('host'), request.nextUrl.pathname, platformHost(), findSlug);
  if ('notFound' in route) return new NextResponse(null, { status: 404 });

  const url = request.nextUrl.clone();
  url.pathname = route.rewrite;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
