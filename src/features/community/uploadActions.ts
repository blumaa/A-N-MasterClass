'use server';
// Upload ticket for post photos and chat files. Space from Host (actionViewer); checks in requestCommunityUpload.
import { randomUUID } from 'node:crypto';
import { actionViewer } from '@/lib/auth/actionViewer';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import type { UploadTicket } from '@/lib/storage/requestUpload';
import { NO_COMMUNITY_UPLOAD, requestCommunityUpload, type CommunityUploadRequest } from './api/uploads';

export async function communityUploadAction(req: CommunityUploadRequest): Promise<UploadTicket> {
  const viewer = await actionViewer();
  if (!viewer?.profile) return { ok: false, message: NO_COMMUNITY_UPLOAD };
  return requestCommunityUpload(getRepo(), getFileStore('community'), viewer, req, randomUUID, new Date());
}
