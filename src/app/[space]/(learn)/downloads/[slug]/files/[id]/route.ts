// One file of a download product: access check, then a 302 to a short-lived signed URL that
// downloads under the file's title (never cached).
import { fileDownload } from '@/features/downloads/api/files';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { signedRedirect } from '@/lib/storage/signedRedirect';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/downloads/[slug]/files/[id]'>) {
  const { space, slug, id } = await ctx.params;
  const viewer = await currentViewer(space);
  const file = viewer && (await fileDownload(getRepo(), viewer, slug, id, new Date()));
  return signedRedirect(file ? await getFileStore().signedUrl(file.path, file.name) : null);
}
