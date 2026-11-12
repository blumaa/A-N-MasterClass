// File of a download part in a step: same access as the step page (grant + module lock + drip),
// then a 302 to a short-lived signed URL that downloads under the part's title (never cached).
import { partDownload } from '@/features/programs/api/step';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { signedRedirect } from '@/lib/storage/signedRedirect';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/programs/[program]/[step]/files/[part]'>) {
  const { space, program, step, part } = await ctx.params;
  const viewer = await currentViewer(space);
  const file = viewer && (await partDownload(getRepo(), viewer, program, step, part, new Date()));
  return signedRedirect(file ? await getFileStore().signedUrl(file.path, file.name) : null);
}
