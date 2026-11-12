import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_MAX_EDGE, preparePhoto } from './photo';
import { JPEG } from './resize';
import { stubCanvas } from './stubCanvas';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('preparePhoto', () => {
  it('cuts the photo to 2048 on the long edge as JPEG, named after the file', async () => {
    const { canvases } = stubCanvas({ natural: { width: 3000, height: 4000 } });

    const photo = await preparePhoto(new File(['x'], 'harness.heic.png', { type: 'image/png' }));

    expect(PHOTO_MAX_EDGE).toBe(2048);
    expect(canvases.map(({ width, height }) => [width, height])).toEqual([[1536, 2048]]);
    expect(photo.type).toBe(JPEG);
    expect(photo.name).toBe('harness.heic.jpg');
  });

  it('keeps a GIF as it is, so it still moves', async () => {
    const { canvases } = stubCanvas();
    const gif = new File(['x'], 'wave.gif', { type: 'image/gif' });

    expect(await preparePhoto(gif)).toBe(gif);
    expect(canvases).toEqual([]);
  });
});
