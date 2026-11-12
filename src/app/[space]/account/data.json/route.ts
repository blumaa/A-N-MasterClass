// Member data export (G25): the viewer's own data in this space as a JSON download. 404 for visitors.
import { exportMyData } from '@/features/account/api/memberData';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/account/data.json'>) {
  const viewer = await currentViewer((await ctx.params).space);
  const data = viewer ? await exportMyData(getRepo(), viewer) : null;
  if (!viewer || !data) return new Response(null, { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${viewer.space.slug}-my-data.json"`,
      'cache-control': 'no-store',
    },
  });
}
