// The photo a community post keeps: long edge 2048, JPEG 0.85 (copied from KSG, G27).
// GIFs pass through so they still move; the upload ticket still checks their size.
import { JPEG, toJpeg, withImage } from './resize';

export const PHOTO_MAX_EDGE = 2048;

export const PHOTO_QUALITY = 0.85;

const jpegName = (name: string): string => `${name.replace(/\.[^.]*$/, '')}.jpg`;

export function preparePhoto(file: File): Promise<File> {
  if (file.type === 'image/gif') return Promise.resolve(file);
  return withImage(file, async (image) => {
    const photo = await toJpeg(image, PHOTO_MAX_EDGE, PHOTO_QUALITY);
    return new File([photo], jpegName(file.name), { type: JPEG });
  });
}
