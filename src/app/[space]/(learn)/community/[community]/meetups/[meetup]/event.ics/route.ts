// "Add to calendar" file for one meetup. The event points at the meetup page on this host,
// never at the join link (that stays gated until shortly before the start).
import { meetupIcs } from '@/features/community/api/meetups';
import { communityShell } from '@/features/community/api/shell';
import { meetupHref } from '@/features/community/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(req: Request, ctx: RouteContext<'/[space]/community/[community]/meetups/[meetup]/event.ics'>) {
  const { space, community, meetup } = await ctx.params;
  const viewer = await currentViewer(space);
  const repo = getRepo();
  const now = new Date();
  const shell = viewer && (await communityShell(repo, viewer, community, now));
  const pageUrl = new URL(meetupHref(community, meetup), req.url).href;
  const ics = shell && (await meetupIcs(repo, shell.community, shell.access, meetup, pageUrl, now));
  if (!ics) return new Response(null, { status: 404 });
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="meetup-${meetup}.ics"`,
      'cache-control': 'no-store',
    },
  });
}
