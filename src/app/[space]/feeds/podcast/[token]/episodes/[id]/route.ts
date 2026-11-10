// Episode enclosure for podcast apps: token check, then a 302 to a short-lived signed URL.
import { feedAudio } from '@/features/podcasts/api/listen';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { signedRedirect } from '@/lib/storage/signedRedirect';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/feeds/podcast/[token]/episodes/[id]'>) {
  const { space, token, id } = await ctx.params;
  const path = await feedAudio(getRepo(), space, token, id, new Date());
  return signedRedirect(path ? await getFileStore().signedUrl(path) : null);
}
