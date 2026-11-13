import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_MAX_EDGE, PHOTO_THUMB_EDGE, preparePhoto } from './photo';
import { JPEG } from './resize';
import { stubCanvas } from './stubCanvas';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('preparePhoto', () => {
  it('cuts the photo to 2048 and a thumbnail to 640 on the long edge, as JPEG, named after the file', async () => {
    const { canvases } = stubCanvas({ natural: { width: 3000, height: 4000 } });

    const { photo, thumb } = await preparePhoto(new File(['x'], 'harness.heic.png', { type: 'image/png' }));

    expect([PHOTO_MAX_EDGE, PHOTO_THUMB_EDGE]).toEqual([2048, 640]);
    expect(canvases.map(({ width, height }) => [width, height])).toEqual([
      [1536, 2048],
      [480, 640],
    ]);
    expect(photo.type).toBe(JPEG);
    expect(photo.name).toBe('harness.heic.jpg');
    expect(thumb?.type).toBe(JPEG);
    expect(thumb?.name).toBe('harness.heic-thumb.jpg');
  });

  it('keeps a GIF as it is, so it still moves, with no thumbnail', async () => {
    const { canvases } = stubCanvas();
    const gif = new File(['x'], 'wave.gif', { type: 'image/gif' });

    expect(await preparePhoto(gif)).toEqual({ photo: gif, thumb: null });
    expect(canvases).toEqual([]);
  });
});
