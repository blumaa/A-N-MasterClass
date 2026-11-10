// brand.css -> custom-property maps per scheme. No imports: scripts/gen-brand-graph.mjs
// loads this file directly with Node's type stripping.

export type BrandScope = Record<string, string>;
export type BrandGraph = { light: BrandScope; dark: BrandScope };

const DARK_SELECTOR = "[data-theme='dark']";

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`brand.css: no ${selector} block`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function declarations(body: string): BrandScope {
  const out: BrandScope = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim().replace(/\s+/g, ' ');
  return out;
}

export function parseBrandCss(css: string): BrandGraph {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return { light: declarations(block(clean, ':root')), dark: declarations(block(clean, DARK_SELECTOR)) };
}
