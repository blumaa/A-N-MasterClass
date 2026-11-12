// Per-space browser icon until logo upload exists: the space's first letter in page colour on
// an ink square. Ink on page is the body-text pair, so the contrast check already covers it.
import { DEFAULT_BRAND, type BrandColors } from '@/tokens/resolveBrand';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function spaceIconSvg(name: string, colors: BrandColors | null): string {
  const brand = colors ?? DEFAULT_BRAND;
  const letter = [...name.trim()][0]?.toUpperCase() ?? '·';
  const text = ESCAPES[letter] ?? letter;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<rect width="64" height="64" rx="14" fill="${brand.ink}"/>`,
    `<text x="32" y="44" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="${brand.page}">${text}</text>`,
    '</svg>',
  ].join('');
}
