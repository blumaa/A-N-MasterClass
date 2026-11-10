import { NextResponse, type NextRequest } from 'next/server';
import { platformHost } from '@/config/platform';
import { resolveHost } from '@/lib/tenancy/resolveHost';
import { routeFor } from '@/lib/tenancy/routeFor';

// Host -> space rewrite. Custom domains resolve via `space_domains` from phase 1;
// until then a custom host has no space and gets 404.
export function proxy(request: NextRequest) {
  const resolution = resolveHost(request.headers.get('host'), platformHost());
  const route = routeFor(resolution, request.nextUrl.pathname, null);
  if ('notFound' in route) return new NextResponse(null, { status: 404 });

  const url = request.nextUrl.clone();
  url.pathname = route.rewrite;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
