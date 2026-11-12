import { vi } from 'vitest';

export interface StubCanvas {
  width: number;
  height: number;
  drawImage: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
}

/* Test only. jsdom has no decoder and no canvas: an Image that loads at a set size, and canvases that record what they drew. */
export function stubCanvas({ natural = { width: 4000, height: 3000 }, fails = false } = {}) {
  const canvases: StubCanvas[] = [];
  const revoked: string[] = [];

  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = natural.width;
      naturalHeight = natural.height;
      set src(_value: string) {
        queueMicrotask(() => (fails ? this.onerror?.() : this.onload?.()));
      }
    },
  );

  const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:picture');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url));

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`);
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      drawImage,
      toBlob: vi.fn((callback: BlobCallback, type?: string) => callback(new Blob(['jpeg'], { type: type ?? '' }))),
      getContext: () => ({ drawImage }),
    };
    canvases.push(canvas);
    return canvas as unknown as HTMLCanvasElement;
  });

  return { canvases, revoked, created };
}
