import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { parseBrandColors, themeCss } from './theme';

describe('parseBrandColors', () => {
  it('accepts a full set of #rrggbb values', () => {
    expect(parseBrandColors(DEFAULT_BRAND)).toEqual(DEFAULT_BRAND);
  });

  it('refuses missing keys, extra keys and non-hex values', () => {
    const { ink: _ink, ...missing } = DEFAULT_BRAND;
    expect(parseBrandColors(missing)).toBeNull();
    expect(parseBrandColors({ ...DEFAULT_BRAND, extra: '#000000' })).toBeNull();
    expect(parseBrandColors({ ...DEFAULT_BRAND, ink: 'red;}body{display:none' })).toBeNull();
    expect(parseBrandColors({ ...DEFAULT_BRAND, ink: '#fff' })).toBeNull();
    expect(parseBrandColors(null)).toBeNull();
    expect(parseBrandColors('x')).toBeNull();
  });
});

describe('themeCss', () => {
  it('is empty when nothing differs from brand.css', () => {
    expect(themeCss({ colors: null, fontHeading: null, fontBody: null }, 'space')).toBe('');
  });

  it('sets the seven inputs on :root, above brand.css specificity', () => {
    const css = themeCss({ colors: { ...DEFAULT_BRAND, accent: '#aa0000' }, fontHeading: null, fontBody: null }, 'space');
    expect(css.startsWith(':root:root{')).toBe(true);
    expect(css).toContain('--brand-accent:#aa0000;');
    expect(css).toContain('--brand-ink:');
  });

  it('sets font stacks from the catalog', () => {
    const css = themeCss({ colors: null, fontHeading: 'lora', fontBody: 'inter' }, 'space');
    expect(css).toBe(':root:root{--mds-font-display:var(--font-lora), serif;--mds-font-body:var(--font-inter), sans-serif;}');
  });

  it('gives a program override higher specificity than the space theme', () => {
    expect(themeCss({ colors: DEFAULT_BRAND, fontHeading: null, fontBody: null }, 'program').startsWith(':root:root:root{')).toBe(
      true,
    );
  });

  it('refuses a value that is not a hex colour (no CSS injection)', () => {
    expect(() =>
      themeCss({ colors: { ...DEFAULT_BRAND, ink: '#000;}*{x:y' }, fontHeading: null, fontBody: null }, 'space'),
    ).toThrow();
  });
});
