// next/font loaders for the curated catalog. Each declares --font-<id> on <html>; files
// download only when a space theme points --mds-font-* at it (preload off).
// next/font needs literal options per call, so ids are spelled out here.
import { DM_Sans, Fraunces, Inter, Lora, Playfair_Display, Source_Sans_3 } from 'next/font/google';
import type { FontId } from './catalog';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', preload: false });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', preload: false });
const sourceSans3 = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans-3', preload: false });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', preload: false });
const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair-display', preload: false });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', preload: false });

export const NEXT_FONTS: Record<FontId, { variable: string }> = {
  inter,
  'dm-sans': dmSans,
  'source-sans-3': sourceSans3,
  lora,
  'playfair-display': playfairDisplay,
  fraunces,
};

/** Class list for <html>: declares every catalog variable. */
export const fontVariables = Object.values(NEXT_FONTS)
  .map((f) => f.variable)
  .join(' ');
