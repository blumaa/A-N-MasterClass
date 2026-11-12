// Studio upload ticket (download files, podcast audio, files of program download parts): checks
// the viewer may edit the product (products.edit, same space, right kind) and the file fits, then
// signs an upload into the product's folder (uploadPath). The browser sends the bytes straight to
// Storage; the form then saves the returned path, which the feature command checks again with
// isProductPath.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import { EPISODE_MAX_BYTES } from '@/lib/data/types';
import { formatBytes } from '@/lib/format/bytes';
import { RESOURCE_MAX_BYTES, type FileStore } from './fileStore';
import { uploadPath } from './uploadPath';

/** Product kinds that take uploads. `program` = files of download parts in steps. */
export const UPLOAD_KINDS = ['download', 'podcast', 'program'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export type UploadRequest = { productId: string; kind: UploadKind; fileName: string; sizeBytes: number };
export type UploadTicket = { ok: true; uploadUrl: string; path: string } | { ok: false; message: string };

/** Per product kind: size ceiling and the file name rule (episodes: .mp3, as the DB checks). */
export const UPLOAD_RULES: Record<UploadKind, { maxBytes: number; accept?: string }> = {
  download: { maxBytes: RESOURCE_MAX_BYTES },
  podcast: { maxBytes: EPISODE_MAX_BYTES, accept: '.mp3,audio/mpeg' },
  program: { maxBytes: RESOURCE_MAX_BYTES },
};

export const NO_UPLOAD = 'You do not have permission to upload files.';
const NOT_FOUND = 'Not found. It may have been deleted.';
const fail = (message: string): UploadTicket => ({ ok: false, message });

const wellFormed = (r: UploadRequest): boolean =>
  typeof r?.productId === 'string' &&
  typeof r.fileName === 'string' &&
  UPLOAD_KINDS.includes(r.kind) &&
  Number.isSafeInteger(r.sizeBytes);

function fileProblem({ kind, fileName, sizeBytes }: UploadRequest): string | null {
  const { maxBytes } = UPLOAD_RULES[kind];
  if (sizeBytes < 1) return 'The file is empty.';
  if (sizeBytes > maxBytes) return `The file is too large (max ${formatBytes(maxBytes)}).`;
  if (kind === 'podcast' && !/\.mp3$/i.test(fileName)) return 'Podcast audio must be an .mp3 file.';
  return null;
}

export async function requestUpload(repo: Repo, files: FileStore, viewer: Viewer, req: UploadRequest, newId: () => string): Promise<UploadTicket> {
  if (!viewer.profile || !viewerCan(viewer, 'products.edit')) return fail(NO_UPLOAD);
  if (!wellFormed(req)) return fail('Invalid upload request.');
  const product = await repo.product(req.productId);
  if (!product || product.spaceId !== viewer.space.id || product.kind !== req.kind) return fail(NOT_FOUND);
  const problem = fileProblem(req);
  if (problem) return fail(problem);
  const path = uploadPath({ spaceId: viewer.space.id, productId: product.id, id: newId(), fileName: req.fileName });
  return { ok: true, uploadUrl: await files.uploadUrl(path), path };
}
