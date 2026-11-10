// Proves a brand against the MDS accessibility contract (the package ships the pairs so
// an app can hold its own brand to them). Shared by the live editor and the save action.
import contract from '@mond-design-system/tokens/contrast-contract.json';
import { composite, contrastRatio } from '@/lib/color/color';
import { resolveBrand, type BrandColors, type Scheme } from '@/tokens/resolveBrand';

export type ContrastFailure = { scheme: Scheme; fg: string; bg: string; ratio: number; min: number };

/** Schemes the product ships. Dark exists in brand.css but no UI turns it on yet. */
export const SHIPPED_SCHEMES: readonly Scheme[] = ['light'];

export function contrastFailures(colors: BrandColors, schemes: readonly Scheme[] = SHIPPED_SCHEMES): ContrastFailure[] {
  const failures: ContrastFailure[] = [];
  for (const scheme of schemes) {
    const color = resolveBrand(colors, scheme);
    const page = color('--mds-surface-page');
    for (const rule of contract.contrast) {
      for (const bgToken of rule.bg) {
        // Translucent tokens are judged as painted: bg over the page, fg over that bg.
        const bg = composite(color(bgToken), page);
        const fg = composite(color(rule.fg), bg);
        const ratio = contrastRatio(fg, bg);
        if (ratio < rule.ratio) failures.push({ scheme, fg: rule.fg, bg: bgToken, ratio, min: rule.ratio });
      }
    }
  }
  return failures;
}
