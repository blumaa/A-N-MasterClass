'use server';
// Upload ticket for site images. Space from Host (actionViewer); checks in requestSiteImageUpload.
import { randomUUID } from 'node:crypto';
import { actionViewer } from '@/lib/auth/actionViewer';
import { getFileStore } from '@/lib/storage/getFileStore';
import type { UploadTicket } from '@/lib/storage/requestUpload';
import { NO_IMAGE_UPLOAD, requestSiteImageUpload, type SiteImageRequest } from '@/lib/storage/requestSiteImageUpload';

export async function requestImageUploadAction(req: SiteImageRequest): Promise<UploadTicket> {
  const viewer = await actionViewer();
  if (!viewer) return { ok: false, message: NO_IMAGE_UPLOAD };
  return requestSiteImageUpload(getFileStore('site'), viewer, req, randomUUID);
}
