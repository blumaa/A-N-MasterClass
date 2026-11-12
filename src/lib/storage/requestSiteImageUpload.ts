// Upload tickets for public images, image type and size checked. Site images (page sections,
// logo): site.edit only, into the space's site folder. Avatars: any member, into their own
// avatar folder. The form saves the returned path, which the save checks again.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { FileStore } from './fileStore';
import type { UploadTicket } from './requestUpload';
import { avatarPath, siteImagePath, siteImageProblem } from './siteImages';

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
  return sign(files, req, () => siteImagePath({ spaceId: viewer.space.id, id: newId(), fileName: req.fileName }));
}

export async function requestAvatarUpload(
  files: FileStore,
  viewer: Viewer,
  req: SiteImageRequest,
  newId: () => string,
): Promise<UploadTicket> {
  const profile = viewer.profile;
  if (!profile) return { ok: false, message: NO_IMAGE_UPLOAD };
  return sign(files, req, () =>
    avatarPath({ spaceId: viewer.space.id, profileId: profile.id, id: newId(), fileName: req.fileName }),
  );
}

async function sign(files: FileStore, req: SiteImageRequest, pathFor: () => string): Promise<UploadTicket> {
  if (!wellFormed(req)) return { ok: false, message: 'Invalid upload request.' };
  const problem = siteImageProblem(req);
  if (problem) return { ok: false, message: problem };
  const path = pathFor();
  return { ok: true, uploadUrl: await files.uploadUrl(path), path };
}
