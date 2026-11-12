// The file of a chat line (channel or DM): read check, then a 302 to a short-lived signed URL.
// Images open inline (chat shows them); other files download under their name.
import { attachmentFile } from '@/features/community/api/fileAccess';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { isImageType } from '@/lib/storage/communityFiles';
import { getFileStore } from '@/lib/storage/getFileStore';
import { signedRedirect } from '@/lib/storage/signedRedirect';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/community/[community]/attachments/[message]'>) {
  const { space, community, message } = await ctx.params;
  const viewer = await currentViewer(space);
  const file = viewer && (await attachmentFile(getRepo(), viewer, community, message, new Date()));
  if (!file) return signedRedirect(null);
  return signedRedirect(await getFileStore('community').signedUrl(file.path, isImageType(file.type) ? undefined : file.name));
}
