// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mixOklab, parseColor, toHex } from '@/lib/color/color';
import { BRAND_GRAPH } from './brandGraph.generated';
import { BRAND_INPUTS } from './brandInputs';
import { parseBrandCss } from './parseBrandCss';
import { DEFAULT_BRAND, resolveBrand } from './resolveBrand';

const here = dirname(fileURLToPath(import.meta.url));

describe('brandGraph.generated.ts', () => {
  it('matches brand.css (run pnpm gen:brand when this fails)', () => {
    expect(BRAND_GRAPH).toEqual(parseBrandCss(readFileSync(join(here, 'brand.css'), 'utf8')));
  });
});

describe('DEFAULT_BRAND', () => {
  it('holds every brand input as the brand.css default', () => {
    expect(Object.keys(DEFAULT_BRAND).toSorted()).toEqual([...BRAND_INPUTS].toSorted());
    expect(DEFAULT_BRAND.accent).toBe('#1f4fbf');
  });
});

describe('resolveBrand', () => {
  const light = resolveBrand(DEFAULT_BRAND, 'light');

  it('follows var() chains to the input', () => {
    expect(toHex(light('--mds-text-primary'))).toBe('#333333');
    expect(toHex(light('--mds-accent'))).toBe('#1f4fbf');
  });

  it('evaluates color-mix against the given inputs', () => {
    const ink = resolveBrand({ ...DEFAULT_BRAND, ink: '#000000', mid: '#ffffff' }, 'light');
    // color-mix(in oklab, var(--brand-mid), var(--brand-ink) 60%) = 60% toward black
    const expected = mixOklab(parseColor('#ffffff')!, parseColor('#000000')!, 0.6);
    expect(toHex(ink('--br-ink-600'))).toBe(toHex(expected));
  });

  it('keeps alpha from transparent mixes', () => {
    expect(light('--mds-scrim').alpha).toBeCloseTo(0.45, 5);
    expect(light('--mds-scrim-strong').alpha).toBeCloseTo(0.94, 5);
  });

  it('uses the dark re-point when the scheme is dark', () => {
    const dark = resolveBrand(DEFAULT_BRAND, 'dark');
    expect(toHex(dark('--mds-text-primary'))).toBe('#fdfaf1');
    expect(toHex(dark('--mds-text-primary'))).not.toBe(toHex(light('--mds-text-primary')));
  });

  it('throws on a token brand.css does not declare', () => {
    expect(() => light('--mds-nope')).toThrow(/--mds-nope/);
  });
});
