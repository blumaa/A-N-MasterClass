import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from 'pdf-lib';
import { parseColor } from '@/lib/color/color';
import { formatDate } from '@/lib/format/date';
import { DEFAULT_BRAND, type BrandColors } from '@/tokens/resolveBrand';
import type { CertificateFonts } from './certificateFonts';

export type CertificateInput = {
  spaceName: string;
  programTitle: string;
  memberName: string;
  issuedAt: Date;
  serial: string;
  colors: BrandColors;
  /** TTF bytes from certificateFonts (brand heading bold, body regular). */
  fonts: CertificateFonts;
  /** Space logo bytes; PNG or JPEG is drawn, anything else (or null) prints the space name. */
  logo: Uint8Array | null;
};

// A4 landscape, in points.
const WIDTH = 842;
const HEIGHT = 595;
const MARGIN = 72;
const MIN_SIZE = 12;
// Logo box, centred at the top inside the border.
const LOGO_WIDTH = 220;
const LOGO_HEIGHT = 72;
const LOGO_TOP = 530;

type Color = ReturnType<typeof rgb>;

function color(colors: BrandColors, key: keyof BrandColors): Color {
  const c = parseColor(colors[key]) ?? parseColor(DEFAULT_BRAND[key]);
  return c ? rgb(c.r, c.g, c.b) : rgb(0, 0, 0);
}

// Glyphs the font lacks (CJK, emoji in a Latin font) are drawn as '?'.
function encodable(font: PDFFont, text: string): string {
  const known = new Set(font.getCharacterSet());
  return Array.from(text, (ch) => (known.has(ch.codePointAt(0) ?? 0) ? ch : '?')).join('');
}

// Shrinks the size until the line fits, then cuts the end.
function fit(font: PDFFont, text: string, size: number, maxWidth: number): { text: string; size: number } {
  let s = size;
  while (s > MIN_SIZE && font.widthOfTextAtSize(text, s) > maxWidth) s -= 1;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t, s) > maxWidth) t = `${t.slice(0, -4)}...`;
  return { text: t, size: s };
}

function centered(page: PDFPage, font: PDFFont, raw: string, y: number, size: number, c: Color) {
  const line = fit(font, encodable(font, raw), size, WIDTH - 2 * MARGIN);
  const x = (WIDTH - font.widthOfTextAtSize(line.text, line.size)) / 2;
  page.drawText(line.text, { x, y, size: line.size, font, color: c });
}

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);

// pdf-lib embeds PNG and JPEG only; a WebP logo falls back to the space name.
async function embedLogo(doc: PDFDocument, logo: Uint8Array | null): Promise<PDFImage | null> {
  if (!logo) return null;
  if (startsWith(logo, [0x89, 0x50, 0x4e, 0x47])) return doc.embedPng(logo);
  if (startsWith(logo, [0xff, 0xd8, 0xff])) return doc.embedJpg(logo);
  return null;
}

function drawLogo(page: PDFPage, logo: PDFImage) {
  const { width, height } = logo.scaleToFit(LOGO_WIDTH, LOGO_HEIGHT);
  page.drawImage(logo, { x: (WIDTH - width) / 2, y: LOGO_TOP - height, width, height });
}

// Builds the completion certificate PDF in the space (or program) colours, brand fonts and logo. pdf-lib types save()
// as Uint8Array<ArrayBufferLike>; the copy is ArrayBuffer-backed, which a Response body needs.
export async function certificatePdf(input: CertificateInput): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate of completion: ${input.programTitle}, ${input.memberName}`);
  doc.setAuthor(input.spaceName);
  doc.setCreationDate(input.issuedAt);
  doc.registerFontkit(fontkit);
  const [heading, body, logo] = await Promise.all([
    doc.embedFont(input.fonts.heading, { subset: true }),
    doc.embedFont(input.fonts.body, { subset: true }),
    embedLogo(doc, input.logo),
  ]);
  const page = doc.addPage([WIDTH, HEIGHT]);

  const accent = color(input.colors, 'accent');
  const ink = color(input.colors, 'ink');
  const mid = color(input.colors, 'mid');
  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: color(input.colors, 'page') });
  page.drawRectangle({
    x: 24, y: 24, width: WIDTH - 48, height: HEIGHT - 48,
    borderColor: accent, borderWidth: 4, color: color(input.colors, 'card'),
  });

  if (logo) drawLogo(page, logo);
  else centered(page, heading, input.spaceName, 480, 22, accent);
  centered(page, heading, 'Certificate of completion', 410, 30, ink);
  centered(page, body, 'This certifies that', 360, 14, mid);
  centered(page, heading, input.memberName, 315, 28, ink);
  centered(page, body, 'has completed', 270, 14, mid);
  centered(page, heading, input.programTitle, 225, 24, ink);
  centered(page, body, formatDate(input.issuedAt), 130, 12, mid);
  centered(page, body, `Certificate no. ${input.serial}`, 108, 10, mid);

  return new Uint8Array(await doc.save());
}
