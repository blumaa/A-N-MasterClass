import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, mixOklab, parseColor, toCss, toHex } from './color';

describe('parseColor', () => {
  it('reads hex (3 and 6 digits), keywords and rgb() with alpha', () => {
    expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1, alpha: 1 });
    expect(parseColor('#1F4FBF')).toEqual({ r: 0x1f / 255, g: 0x4f / 255, b: 0xbf / 255, alpha: 1 });
    expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0, alpha: 1 });
    expect(parseColor('white')).toEqual({ r: 1, g: 1, b: 1, alpha: 1 });
    expect(parseColor('transparent')?.alpha).toBe(0);
    expect(parseColor('rgb(0 0 0 / 0.6)')).toEqual({ r: 0, g: 0, b: 0, alpha: 0.6 });
  });

  it('returns null for anything else', () => {
    expect(parseColor('red')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
    expect(parseColor('url(x)')).toBeNull();
  });
});

describe('toHex', () => {
  it('round-trips hex', () => {
    expect(toHex(parseColor('#1f4fbf')!)).toBe('#1f4fbf');
  });
});

describe('mixOklab (CSS color-mix percent rules)', () => {
  const black = parseColor('black')!;
  const white = parseColor('white')!;

  it('returns the ends at 0% and 100%', () => {
    expect(toHex(mixOklab(black, white, 0))).toBe('#000000');
    expect(toHex(mixOklab(black, white, 1))).toBe('#ffffff');
  });

  it('mixes black and white in oklab to mid grey (L = 0.5 is #636363)', () => {
    expect(toHex(mixOklab(black, white, 0.5))).toBe('#636363');
  });

  it('premultiplies alpha: mixing with transparent keeps the hue and drops alpha', () => {
    const c = parseColor('#336699')!;
    const out = mixOklab(c, parseColor('transparent')!, 0.55);
    expect(out.alpha).toBeCloseTo(0.45, 5);
    expect(toHex(out)).toBe('#336699');
  });
});

describe('composite + contrastRatio (WCAG 2)', () => {
  it('scores black on white 21 and equal colours 1', () => {
    expect(contrastRatio(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor('#777')!, parseColor('#777')!)).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    const a = parseColor('#1f4fbf')!;
    const b = parseColor('#fdfaf1')!;
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it('lays a translucent colour over its backdrop (source-over in sRGB)', () => {
    const half = { r: 1, g: 1, b: 1, alpha: 0.5 };
    const out = composite(half, parseColor('#000')!);
    expect(out).toEqual({ r: 0.5, g: 0.5, b: 0.5, alpha: 1 });
  });
});

describe('toCss', () => {
  it('is hex when opaque, rgb with alpha otherwise, and parses back', () => {
    expect(toCss(parseColor('#1f4fbf')!)).toBe('#1f4fbf');
    const css = toCss({ r: 1, g: 0, b: 0, alpha: 0.45 });
    expect(css).toBe('rgb(255 0 0 / 0.45)');
    expect(parseColor(css)).toEqual({ r: 1, g: 0, b: 0, alpha: 0.45 });
  });
});
