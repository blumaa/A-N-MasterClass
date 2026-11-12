'use server';
// Upload ticket for Studio file fields. Space from Host (actionViewer); checks in requestUpload.
import { randomUUID } from 'node:crypto';
import { actionViewer } from '@/lib/auth/actionViewer';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { NO_UPLOAD, requestUpload, type UploadRequest, type UploadTicket } from '@/lib/storage/requestUpload';

export async function requestUploadAction(req: UploadRequest): Promise<UploadTicket> {
  const viewer = await actionViewer();
  if (!viewer) return { ok: false, message: NO_UPLOAD };
  return requestUpload(getRepo(), getFileStore(), viewer, req, randomUUID);
}
