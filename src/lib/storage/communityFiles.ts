// Member files in the `community` bucket: photos on feed posts, one attachment per chat line.
// SSOT for folders, types and sizes. Mirrored in SQL by migration 20261112100000
// (channel_folder, thread_folder, in_folder, bucket file_size_limit + allowed_mime_types).
import { formatBytes } from '@/lib/format/bytes';
import { safeFileName } from './uploadPath';

/** Bucket `community` file_size_limit. */
export const COMMUNITY_MAX_BYTES = 26_214_400;
/** Photos are resized in the browser first; this only stops a bad client. */
export const PHOTO_MAX_BYTES = 10_000_000;
/** Photos per post. SQL: post_photos_check trigger. */
export const POST_PHOTOS_MAX = 10;

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
/** Bucket allowed_mime_types. */
export const ATTACHMENT_TYPES = [
  ...PHOTO_TYPES,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
] as const;

export type CommunityFileKind = 'photo' | 'attachment';

export const isImageType = (type: string): boolean => (PHOTO_TYPES as readonly string[]).includes(type);

export const channelFolder = (spaceId: string, communityId: string, channelId: string): string =>
  `${spaceId}/${communityId}/${channelId}/`;
export const threadFolder = (spaceId: string, communityId: string, threadId: string): string =>
  `${spaceId}/${communityId}/dm/${threadId}/`;
export const communityFilePath = (folder: string, id: string, fileName: string): string =>
  `${folder}${id}-${safeFileName(fileName)}`;

/** Why this file cannot be uploaded, or null. */
export function communityFileProblem(kind: CommunityFileKind, type: string, sizeBytes: number): string | null {
  const photo = kind === 'photo';
  const types: readonly string[] = photo ? PHOTO_TYPES : ATTACHMENT_TYPES;
  if (!types.includes(type)) return photo ? 'Photos must be JPEG, PNG, WebP or GIF images.' : 'This file type is not allowed.';
  if (sizeBytes < 1) return 'The file is empty.';
  const max = photo ? PHOTO_MAX_BYTES : COMMUNITY_MAX_BYTES;
  if (sizeBytes > max) return `The file is too large (max ${formatBytes(max)}).`;
  return null;
}
