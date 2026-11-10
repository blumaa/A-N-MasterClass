import { describe, expect, it } from 'vitest';
import { FONT_IDS, fontStack, isFontId } from './catalog';

describe('font catalog', () => {
  it('knows its own ids only', () => {
    expect(FONT_IDS.length).toBeGreaterThan(0);
    for (const id of FONT_IDS) expect(isFontId(id)).toBe(true);
    expect(isFontId('Comic Sans')).toBe(false);
    expect(isFontId('__proto__')).toBe(false);
  });

  it('builds a stack from the next/font variable plus a generic fallback', () => {
    expect(fontStack('lora')).toBe('var(--font-lora), serif');
    expect(fontStack('inter')).toBe('var(--font-inter), sans-serif');
  });
});
