// In-browser playback: access check, then a 302 to a short-lived signed URL (never cached).
import { episodeAudio } from '@/features/podcasts/api/listen';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { signedRedirect } from '@/lib/storage/signedRedirect';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/podcasts/[slug]/episodes/[id]/audio'>) {
  const { space, slug, id } = await ctx.params;
  const viewer = await currentViewer(space);
  const path = viewer && (await episodeAudio(getRepo(), viewer, slug, id, new Date()));
  return signedRedirect(path ? await getFileStore().signedUrl(path) : null);
}
