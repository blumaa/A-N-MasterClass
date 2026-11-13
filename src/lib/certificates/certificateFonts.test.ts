import { describe, expect, it } from 'vitest';
import { FONT_IDS } from '@/lib/fonts/catalog';
import { certificateFonts, fontFile } from './certificateFonts';

const TTF = [0x00, 0x01, 0x00, 0x00];

describe('certificateFonts', () => {
  it('ships a bold and a regular TTF for every catalog font', async () => {
    for (const id of FONT_IDS) {
      const fonts = await certificateFonts({ heading: id, body: id });
      expect(Array.from(fonts.heading.slice(0, 4))).toEqual(TTF);
      expect(Array.from(fonts.body.slice(0, 4))).toEqual(TTF);
    }
  });

  it('names files by font id and weight', () => {
    expect(fontFile('lora', 700)).toMatch(/lora-700\.ttf$/);
    expect(fontFile('inter', 400)).toMatch(/inter-400\.ttf$/);
  });

  it('defaults to Lora headings and Inter body like the MDS serif and sans defaults', async () => {
    const [defaults, explicit] = await Promise.all([
      certificateFonts({ heading: null, body: null }),
      certificateFonts({ heading: 'lora', body: 'inter' }),
    ]);
    expect(defaults).toEqual(explicit);
  });
});
