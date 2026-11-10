import { describe, expect, it, vi } from 'vitest';
import { FONT_IDS, fontVar } from './catalog';

// next/font is compiled by Next; in tests each loader echoes its options.
vi.mock('next/font/google', () => {
  const loader = (opts: { variable: string }) => ({ variable: `class${opts.variable}`, options: opts });
  return { Inter: loader, DM_Sans: loader, Source_Sans_3: loader, Lora: loader, Playfair_Display: loader, Fraunces: loader };
});

describe('nextFonts', () => {
  it('declares --font-<id> for every catalog font, without preloading', async () => {
    const { NEXT_FONTS } = await import('./nextFonts');
    for (const id of FONT_IDS) {
      const font = NEXT_FONTS[id] as unknown as { options: { variable: string; preload: boolean } };
      expect(font.options.variable).toBe(fontVar(id));
      expect(font.options.preload).toBe(false);
    }
  });
});
