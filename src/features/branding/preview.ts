// Live preview values. brand.css aliases resolve at :root, so setting --brand-* on a
// wrapper would not re-derive them; the preview sets every resolved --mds-* instead.
import { toCss } from '@/lib/color/color';
import { BRAND_GRAPH } from '@/tokens/brandGraph.generated';
import { resolveBrand, type BrandColors } from '@/tokens/resolveBrand';

// Only aliases that reference other vars can vary with the brand; literal values
// (fonts, shadow channels, fixed scrims) are already right from brand.css.
const MDS_TOKENS = Object.entries(BRAND_GRAPH.light)
  .filter(([t, v]) => t.startsWith('--mds-') && v.includes('var('))
  .map(([t]) => t);

export function previewVars(colors: BrandColors): Record<string, string> {
  const color = resolveBrand(colors, 'light');
  return Object.fromEntries(MDS_TOKENS.map((t) => [t, toCss(color(t))]));
}
