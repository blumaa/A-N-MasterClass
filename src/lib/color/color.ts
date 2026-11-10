// Colour math for brand checks. Mirrors what browsers do for the subset brand.css uses:
// hex / black / white / transparent / rgb(r g b / a), `color-mix(in oklab, ...)` with
// premultiplied alpha (CSS Color 5), and WCAG 2 contrast ratio.
// Sources: https://www.w3.org/TR/css-color-5/#color-mix, https://bottosson.github.io/posts/oklab/,
// https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

/** sRGB channels 0..1 (gamma encoded), alpha 0..1. */
export type Rgba = { r: number; g: number; b: number; alpha: number };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[/,]\s*([\d.]+%?))?\s*\)$/i;

const KEYWORDS: Record<string, Rgba> = {
  black: { r: 0, g: 0, b: 0, alpha: 1 },
  white: { r: 1, g: 1, b: 1, alpha: 1 },
  transparent: { r: 0, g: 0, b: 0, alpha: 0 },
};

export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (s in KEYWORDS) return { ...KEYWORDS[s]! };
  const hex = HEX.exec(s)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), alpha: 1 };
  }
  const rgb = RGB.exec(s);
  if (rgb) {
    const a = rgb[4];
    const alpha = a === undefined ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
    return { r: +rgb[1]! / 255, g: +rgb[2]! / 255, b: +rgb[3]! / 255, alpha };
  }
  return null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function toHex(c: Rgba): string {
  const h = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** CSS string: hex when opaque, `rgb(r g b / a)` otherwise. */
export function toCss(c: Rgba): string {
  if (c.alpha >= 1) return toHex(c);
  const ch = (v: number) => Math.round(clamp01(v) * 255);
  return `rgb(${ch(c.r)} ${ch(c.g)} ${ch(c.b)} / ${+c.alpha.toFixed(3)})`;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

type Lab = [number, number, number];

function toOklab({ r, g, b }: Rgba): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: Lab, alpha: number): Rgba {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: clamp01(toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    alpha,
  };
}

/** color-mix(in oklab, a, b `t`) where t = share of b (0..1), premultiplied alpha. */
export function mixOklab(a: Rgba, b: Rgba, t: number): Rgba {
  const alpha = a.alpha * (1 - t) + b.alpha * t;
  if (alpha === 0) return { r: 0, g: 0, b: 0, alpha: 0 };
  const la = toOklab(a);
  const lb = toOklab(b);
  const lab = la.map((v, i) => (v * a.alpha * (1 - t) + lb[i]! * b.alpha * t) / alpha) as Lab;
  return fromOklab(lab, alpha);
}

/** Source-over: `top` painted on an opaque `bottom`. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const k = top.alpha;
  return {
    r: top.r * k + bottom.r * (1 - k),
    g: top.g * k + bottom.g * (1 - k),
    b: top.b * k + bottom.b * (1 - k),
    alpha: 1,
  };
}

const luminance = ({ r, g, b }: Rgba) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
