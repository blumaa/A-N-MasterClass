// Copied from kinbaku-study-group (G27): browser resize for member photos.
export const JPEG = 'image/jpeg';

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function decode(file: File): Promise<{ image: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(file);
  const release = () => URL.revokeObjectURL(url);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, release });
    image.onerror = () => {
      release();
      reject(new Error(`Could not read ${file.name}`));
    };
    image.src = url;
  });
}

/* One decode for every cut taken from it; the object URL goes when `cut` settles. */
export async function withImage<T>(file: File, cut: (image: HTMLImageElement) => Promise<T>): Promise<T> {
  const { image, release } = await decode(file);
  try {
    return await cut(image);
  } finally {
    release();
  }
}

export async function toJpeg(image: HTMLImageElement, max: number, quality: number): Promise<Blob> {
  const size = fitWithin(image.naturalWidth, image.naturalHeight, max);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2d canvas: the picture cannot be resized here.');
  context.drawImage(image, 0, 0, size.width, size.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, JPEG, quality));
  if (!blob) throw new Error('Could not encode the picture');

  return blob;
}
