// Per-space browser icon. A route handler, not Next's icon.tsx convention: that one links
// /<slug>/icon, which the host rewrite in proxy.ts would turn into /<slug>/<slug>/icon.
import type { NextRequest } from 'next/server';
import { spaceTheme } from '@/features/branding/api/branding';
import { spaceIconSvg } from '@/features/branding/icon';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(_req: NextRequest, ctx: RouteContext<'/[space]/brand-icon.svg'>) {
  const repo = getRepo();
  const space = await repo.spaceBySlug((await ctx.params).space);
  if (!space) return new Response(null, { status: 404 });
  const theme = await spaceTheme(repo, space.id);
  return new Response(spaceIconSvg(space.name, theme.colors), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
}
