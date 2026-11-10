// Evaluates brand.css aliases for a given set of brand inputs, as the browser would.
// Used to prove contrast before a brand is saved and to paint the live preview.
import { mixOklab, parseColor, type Rgba } from '@/lib/color/color';
import { BRAND_GRAPH } from './brandGraph.generated';
import { BRAND_INPUTS, type BrandInput } from './brandInputs';

export type BrandColors = Record<BrandInput, string>;
export type Scheme = 'light' | 'dark';

export const brandVar = (input: BrandInput) => `--brand-${input}`;

/** brand.css :root defaults (SSOT: the CSS file, via the generated graph). */
export const DEFAULT_BRAND: BrandColors = Object.fromEntries(
  BRAND_INPUTS.map((input) => [input, BRAND_GRAPH.light[brandVar(input)]!]),
) as BrandColors;

const VAR = /^var\((--[a-z0-9-]+)\)$/;
const MIX = /^color-mix\(in oklab,(.*)\)$/;
const PCT = /^(.*?)\s+([\d.]+)%$/;

// Split on commas not inside parentheses.
function args(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function withPercent(arg: string): { expr: string; pct: number | null } {
  const m = PCT.exec(arg);
  return m ? { expr: m[1]!.trim(), pct: parseFloat(m[2]!) / 100 } : { expr: arg, pct: null };
}

/** Returns a resolver for one brand + scheme. Same element model: dark declarations
 *  override light ones and every var() is read in the active scheme. */
export function resolveBrand(colors: BrandColors, scheme: Scheme): (token: string) => Rgba {
  const memo = new Map<string, Rgba>();
  const inputs = new Map(BRAND_INPUTS.map((i) => [brandVar(i), colors[i]]));

  function declared(token: string): string {
    const value = inputs.get(token) ?? (scheme === 'dark' ? BRAND_GRAPH.dark[token] : undefined) ?? BRAND_GRAPH.light[token];
    if (value === undefined) throw new Error(`brand.css declares no ${token}`);
    return value;
  }

  function evaluate(expr: string, seen: Set<string>): Rgba {
    const v = VAR.exec(expr);
    if (v) return lookup(v[1]!, seen);
    const mix = MIX.exec(expr);
    if (mix) {
      const [a, b] = args(mix[1]!).map(withPercent);
      if (!a || !b) throw new Error(`bad color-mix: ${expr}`);
      // CSS Color 5 percent normalisation.
      let p1 = a.pct ?? (b.pct === null ? 0.5 : 1 - b.pct);
      let p2 = b.pct ?? 1 - p1;
      const sum = p1 + p2;
      p1 /= sum;
      p2 /= sum;
      const out = mixOklab(evaluate(a.expr, seen), evaluate(b.expr, seen), p2);
      return sum < 1 ? { ...out, alpha: out.alpha * sum } : out;
    }
    const color = parseColor(expr);
    if (!color) throw new Error(`not a colour: ${expr}`);
    return color;
  }

  function lookup(token: string, seen: Set<string> = new Set()): Rgba {
    const hit = memo.get(token);
    if (hit) return hit;
    if (seen.has(token)) throw new Error(`brand.css cycle at ${token}`);
    const value = evaluate(declared(token), new Set([...seen, token]));
    memo.set(token, value);
    return value;
  }

  return (token) => lookup(token);
}
