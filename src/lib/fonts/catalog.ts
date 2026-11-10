// Curated brand fonts (plan: "curated list, not free text"). Pure data, safe on client.
// Loaders live in nextFonts.ts; each id maps to next/font's CSS variable --font-<id>.
const CATALOG = {
  inter: { label: 'Inter', generic: 'sans-serif' },
  'dm-sans': { label: 'DM Sans', generic: 'sans-serif' },
  'source-sans-3': { label: 'Source Sans 3', generic: 'sans-serif' },
  lora: { label: 'Lora', generic: 'serif' },
  'playfair-display': { label: 'Playfair Display', generic: 'serif' },
  fraunces: { label: 'Fraunces', generic: 'serif' },
} as const;

export type FontId = keyof typeof CATALOG;
export const FONT_IDS = Object.keys(CATALOG) as FontId[];

export const isFontId = (value: unknown): value is FontId =>
  typeof value === 'string' && Object.hasOwn(CATALOG, value);

export const fontLabel = (id: FontId): string => CATALOG[id].label;
export const fontVar = (id: FontId): string => `--font-${id}`;
export const fontStack = (id: FontId): string => `var(${fontVar(id)}), ${CATALOG[id].generic}`;
