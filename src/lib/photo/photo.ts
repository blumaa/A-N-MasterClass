// The photo a community post keeps: long edge 2048, JPEG 0.85 (copied from KSG, G27),
// plus a 640 thumbnail for the feed grid (made here: Storage image transformations are paid).
// GIFs pass through so they still move, with no thumbnail; the upload ticket still checks their size.
import { JPEG, toJpeg, withImage } from './resize';

export const PHOTO_MAX_EDGE = 2048;

export const PHOTO_THUMB_EDGE = 640;

export const PHOTO_QUALITY = 0.85;

export type PreparedPhoto = { photo: File; thumb: File | null };

const baseName = (name: string): string => name.replace(/\.[^.]*$/, '');

export function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.type === 'image/gif') return Promise.resolve({ photo: file, thumb: null });
  return withImage(file, async (image) => {
    const photo = await toJpeg(image, PHOTO_MAX_EDGE, PHOTO_QUALITY);
    const thumb = await toJpeg(image, PHOTO_THUMB_EDGE, PHOTO_QUALITY);
    return {
      photo: new File([photo], `${baseName(file.name)}.jpg`, { type: JPEG }),
      thumb: new File([thumb], `${baseName(file.name)}-thumb.jpg`, { type: JPEG }),
    };
  });
}
