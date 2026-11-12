import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { spaceIconSvg } from './icon';

describe('spaceIconSvg', () => {
  it('draws the first letter of the space name in page colour on ink', () => {
    const svg = spaceIconSvg('fiddle', { ...DEFAULT_BRAND, ink: '#111111', page: '#fafafa' });
    expect(svg).toContain('fill="#111111"');
    expect(svg).toContain('fill="#fafafa"');
    expect(svg).toMatch(/>F<\/text>/);
  });

  it('falls back to the default brand without colours', () => {
    expect(spaceIconSvg('Ana', null)).toContain(`fill="${DEFAULT_BRAND.ink}"`);
  });

  it('escapes a letter that is markup', () => {
    expect(spaceIconSvg('<b>', null)).toMatch(/>&lt;<\/text>/);
  });

  it('uses a dot for an empty name', () => {
    expect(spaceIconSvg('  ', null)).toMatch(/>·<\/text>/);
  });
});
