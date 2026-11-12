// Studio upload ticket for site images (page sections, logo): site.edit only, image type and
// size checked, signed into the space's site folder. The form saves the returned path, which
// validateSection checks again with isSiteImagePath.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { FileStore } from './fileStore';
import type { UploadTicket } from './requestUpload';
import { siteImagePath, siteImageProblem } from './siteImages';

export type SiteImageRequest = { fileName: string; sizeBytes: number };

export const NO_IMAGE_UPLOAD = 'You do not have permission to upload images.';

const wellFormed = (r: SiteImageRequest): boolean =>
  typeof r?.fileName === 'string' && Number.isSafeInteger(r.sizeBytes);

export async function requestSiteImageUpload(
  files: FileStore,
  viewer: Viewer,
  req: SiteImageRequest,
  newId: () => string,
): Promise<UploadTicket> {
  if (!viewer.profile || !viewerCan(viewer, 'site.edit')) return { ok: false, message: NO_IMAGE_UPLOAD };
  if (!wellFormed(req)) return { ok: false, message: 'Invalid upload request.' };
  const problem = siteImageProblem(req);
  if (problem) return { ok: false, message: problem };
  const path = siteImagePath({ spaceId: viewer.space.id, id: newId(), fileName: req.fileName });
  return { ok: true, uploadUrl: await files.uploadUrl(path), path };
}
