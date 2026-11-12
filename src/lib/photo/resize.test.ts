import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas } from './stubCanvas';
import { JPEG, fitWithin, toJpeg, withImage } from './resize';

describe('fitWithin', () => {
  it('puts the long edge on the max and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 512)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(3000, 4000, 512)).toEqual({ width: 384, height: 512 });
    expect(fitWithin(2000, 2000, 512)).toEqual({ width: 512, height: 512 });
  });

  it('never enlarges — a small picture is left alone', () => {
    expect(fitWithin(200, 120, 512)).toEqual({ width: 200, height: 120 });
    expect(fitWithin(512, 100, 512)).toEqual({ width: 512, height: 100 });
  });

  it('rounds to whole pixels and never to nothing', () => {
    expect(fitWithin(1000, 333, 512)).toEqual({ width: 512, height: 170 });
    expect(fitWithin(4000, 3, 512).height).toBe(1);
  });
});

const PHOTO = new File(['x'], 'IMG_0001.png', { type: 'image/png' });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('withImage and toJpeg', () => {
  it('draws at the size fitWithin computed and encodes JPEG at the quality asked', async () => {
    const { canvases } = stubCanvas();

    const blob = await withImage(PHOTO, (image) => toJpeg(image, 640, 0.8));

    const [canvas] = canvases;
    expect(canvas).toMatchObject({ width: 640, height: 480 });
    expect(canvas?.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 480);
    expect(canvas?.toBlob).toHaveBeenCalledWith(expect.any(Function), JPEG, 0.8);
    expect(blob.type).toBe(JPEG);
  });

  it('decodes once for as many cuts as are asked of it', async () => {
    const { canvases, created } = stubCanvas();

    await withImage(PHOTO, (image) => Promise.all([toJpeg(image, 2048, 0.85), toJpeg(image, 640, 0.85)]));

    expect(created).toHaveBeenCalledTimes(1);
    expect(canvases.map(({ width, height }) => [width, height])).toEqual([
      [2048, 1536],
      [640, 480],
    ]);
  });

  it('releases the object URL on success and on failure, naming the file that would not decode', async () => {
    const ok = stubCanvas();
    await withImage(PHOTO, (image) => toJpeg(image, 640, 0.85));
    expect(ok.revoked).toEqual(['blob:picture']);

    vi.restoreAllMocks();
    const broken = stubCanvas({ fails: true });
    await expect(withImage(PHOTO, (image) => toJpeg(image, 640, 0.85))).rejects.toThrow(/IMG_0001/);
    expect(broken.revoked).toEqual(['blob:picture']);
  });
});
