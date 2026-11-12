// Per-space manifest. Next's manifest.ts convention is app-root only, so the space
// version is a route handler; proxy.ts rewrites /manifest.webmanifest here per host.
import type { NextRequest } from 'next/server';
import { spaceMarks, spaceTheme } from '@/features/branding/api/branding';
import { spaceManifest } from '@/features/branding/manifest';
import { getRepo } from '@/lib/data/getRepo';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';

export async function GET(_req: NextRequest, ctx: RouteContext<'/[space]/manifest.webmanifest'>) {
  const repo = getRepo();
  const space = await repo.spaceBySlug((await ctx.params).space);
  if (!space) return new Response(null, { status: 404 });
  const [theme, { faviconPath }] = await Promise.all([spaceTheme(repo, space.id), spaceMarks(repo, space.id)]);
  const icon = faviconPath ? siteImageSrc(faviconPath) : null;
  return Response.json(spaceManifest(space.name, theme.colors, icon), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
