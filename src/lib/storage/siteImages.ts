// Page builder photos (hero, image + text, bio) and the space logo. Bucket `site` is public so
// published pages stay cacheable; uploads are still signed by the server only (no storage
// policies). Stored value = object path; the URL is built from it when rendering.
import { formatBytes } from '@/lib/format/bytes';
import { inFolder, safeFileName } from './uploadPath';

/** Bucket `site` file_size_limit (migration 20261112210000). */
export const SITE_IMAGE_MAX_BYTES = 10_485_760;
export const SITE_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

const folder = (spaceId: string) => `${spaceId}/site/`;

export type SiteImagePathInput = { spaceId: string; id: string; fileName: string };

export const siteImagePath = ({ spaceId, id, fileName }: SiteImagePathInput): string =>
  `${folder(spaceId)}${id}-${safeFileName(fileName)}`;

export const isSiteImagePath = (path: string, spaceId: string): boolean => inFolder(path, folder(spaceId));

export function siteImageProblem({ fileName, sizeBytes }: { fileName: string; sizeBytes: number }): string | null {
  if (sizeBytes < 1) return 'The file is empty.';
  if (sizeBytes > SITE_IMAGE_MAX_BYTES) return `The image is too large (max ${formatBytes(SITE_IMAGE_MAX_BYTES)}).`;
  if (!IMAGE_EXT.test(fileName)) return 'Use a JPG, PNG or WebP image.';
  return null;
}

/** Public URL of a stored site image. `base` = NEXT_PUBLIC_SUPABASE_URL. */
export const siteImageUrl = (path: string, base: string): string =>
  `${base}/storage/v1/object/public/site/${path.split('/').map(encodeURIComponent).join('/')}`;
