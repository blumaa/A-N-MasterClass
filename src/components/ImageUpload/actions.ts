'use server';
// Upload ticket for public images. Space from Host (actionViewer); checks in requestSiteImageUpload.
import { randomUUID } from 'node:crypto';
import { actionViewer } from '@/lib/auth/actionViewer';
import { getFileStore } from '@/lib/storage/getFileStore';
import type { UploadTicket } from '@/lib/storage/requestUpload';
import {
  NO_IMAGE_UPLOAD,
  requestAvatarUpload,
  requestSiteImageUpload,
  type SiteImageRequest,
} from '@/lib/storage/requestSiteImageUpload';

export type ImageTarget = 'site' | 'avatar';

export async function requestImageUploadAction(target: ImageTarget, req: SiteImageRequest): Promise<UploadTicket> {
  const viewer = await actionViewer();
  if (!viewer) return { ok: false, message: NO_IMAGE_UPLOAD };
  const request = target === 'avatar' ? requestAvatarUpload : requestSiteImageUpload;
  return request(getFileStore('site'), viewer, req, randomUUID);
}
