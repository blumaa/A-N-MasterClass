// One photo of a community post: read check on the post, then a 302 to a short-lived signed URL.
import { postPhotoPath } from '@/features/community/api/fileAccess';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { signedRedirect } from '@/lib/storage/signedRedirect';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/community/[community]/posts/[post]/photos/[photo]'>) {
  const { space, community, post, photo } = await ctx.params;
  const viewer = await currentViewer(space);
  const path = viewer && (await postPhotoPath(getRepo(), viewer, community, post, photo, new Date()));
  return signedRedirect(path ? await getFileStore('community').signedUrl(path) : null);
}
