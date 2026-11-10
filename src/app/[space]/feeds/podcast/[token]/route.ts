// Private RSS feed for podcast apps. No login: the token in the path is the credential.
import { feedXml } from '@/features/podcasts/api/listen';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(req: Request, ctx: RouteContext<'/[space]/feeds/podcast/[token]'>) {
  const { space, token } = await ctx.params;
  const xml = await feedXml(getRepo(), space, token, new URL(req.url).origin, new Date());
  if (!xml) return new Response(null, { status: 404 });
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}
