// Runtime theme: the 7 brand inputs (+ fonts) set on :root per request. brand.css stays
// static and derives every --mds-* alias from them at :root (plan: Branding).
import { fontStack, type FontId } from '@/lib/fonts/catalog';
import { BRAND_INPUTS } from '@/tokens/brandInputs';
import { brandVar, type BrandColors } from '@/tokens/resolveBrand';

export const HEX = /^#[0-9a-f]{6}$/i;

export type Theme = { colors: BrandColors | null; fontHeading: FontId | null; fontBody: FontId | null };

/** Exactly the 7 inputs, each #rrggbb. Anything else = null. */
export function parseBrandColors(value: unknown): BrandColors | null {
  if (typeof value !== 'object' || value === null) return null;
  const entries = Object.entries(value);
  if (entries.length !== BRAND_INPUTS.length) return null;
  const record = value as Record<string, unknown>;
  for (const input of BRAND_INPUTS) {
    const v = record[input];
    if (typeof v !== 'string' || !HEX.test(v)) return null;
  }
  return value as BrandColors;
}

// Specificity above brand.css (:root) for the space; program override above the space.
const SELECTOR = { space: ':root:root', program: ':root:root:root' } as const;

export function themeCss(theme: Theme, scope: keyof typeof SELECTOR): string {
  const decls: string[] = [];
  if (theme.colors) {
    for (const input of BRAND_INPUTS) {
      const value = theme.colors[input];
      // Values reach a <style> tag; only validated hex may pass.
      if (!HEX.test(value)) throw new Error(`brand ${input} is not #rrggbb: ${JSON.stringify(value)}`);
      decls.push(`${brandVar(input)}:${value};`);
    }
  }
  if (theme.fontHeading) decls.push(`--mds-font-display:${fontStack(theme.fontHeading)};`);
  if (theme.fontBody) decls.push(`--mds-font-body:${fontStack(theme.fontBody)};`);
  return decls.length ? `${SELECTOR[scope]}{${decls.join('')}}` : '';
}
