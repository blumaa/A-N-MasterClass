// TTF bytes for the certificate PDF, picked from the brand fonts (src/lib/fonts/catalog.ts is the list).
// Files in ./fonts are static Google Fonts cuts (SIL OFL, licence next to each). Read once per process.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FontId } from '@/lib/fonts/catalog';

export type CertificateFonts = { heading: Uint8Array; body: Uint8Array };
type Weight = 400 | 700;

// MDS defaults are a serif display face and a system sans body; these are the closest catalog fonts.
const DEFAULT_HEADING: FontId = 'lora';
const DEFAULT_BODY: FontId = 'inter';

const FONT_DIR = path.join(process.cwd(), 'src/lib/certificates/fonts');
const cache = new Map<string, Promise<Uint8Array>>();

export const fontFile = (id: FontId, weight: Weight): string => path.join(FONT_DIR, `${id}-${weight}.ttf`);

function load(id: FontId, weight: Weight): Promise<Uint8Array> {
  const file = fontFile(id, weight);
  let bytes = cache.get(file);
  if (!bytes) {
    bytes = readFile(file).then((b) => new Uint8Array(b));
    bytes.catch(() => cache.delete(file));
    cache.set(file, bytes);
  }
  return bytes;
}

/** Heading in bold, body in regular. */
export async function certificateFonts(brand: { heading: FontId | null; body: FontId | null }): Promise<CertificateFonts> {
  const [heading, body] = await Promise.all([load(brand.heading ?? DEFAULT_HEADING, 700), load(brand.body ?? DEFAULT_BODY, 400)]);
  return { heading, body };
}
