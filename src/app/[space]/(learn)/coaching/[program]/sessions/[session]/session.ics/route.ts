// "Add to calendar" file for one coaching session. Points at the session page on this host.
import { sessionIcs } from '@/features/coaching/api/booking';
import { sessionHref } from '@/features/coaching/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(req: Request, ctx: RouteContext<'/[space]/coaching/[program]/sessions/[session]/session.ics'>) {
  const { space, program, session } = await ctx.params;
  const viewer = await currentViewer(space);
  const pageUrl = new URL(sessionHref(program, session), req.url).href;
  const ics = viewer && (await sessionIcs(getRepo(), viewer, session, pageUrl, new Date()));
  if (!ics) return new Response(null, { status: 404 });
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="session-${session}.ics"`,
      'cache-control': 'no-store',
    },
  });
}
