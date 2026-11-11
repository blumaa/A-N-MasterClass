// Staff export of a challenge's entries; 404 for anyone who cannot see them.
import { challengeCsv, challengePage } from '@/features/community/api/challenges';
import { communityShell } from '@/features/community/api/shell';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/community/[community]/challenges/[challenge]/entries.csv'>) {
  const { space, community, challenge } = await ctx.params;
  const viewer = await currentViewer(space);
  const repo = getRepo();
  const now = new Date();
  const shell = viewer && (await communityShell(repo, viewer, community, now));
  const page = viewer && shell && (await challengePage(repo, viewer, shell.community, shell.access, challenge, now));
  if (!page?.entries) return new Response(null, { status: 404 });
  return new Response(challengeCsv(page.entries), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="challenge-${page.challenge.id}-entries.csv"`,
      'cache-control': 'no-store',
    },
  });
}
