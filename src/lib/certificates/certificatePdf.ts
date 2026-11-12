import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { parseColor } from '@/lib/color/color';
import { formatDate } from '@/lib/format/date';
import { DEFAULT_BRAND, type BrandColors } from '@/tokens/resolveBrand';

export type CertificateInput = {
  spaceName: string;
  programTitle: string;
  memberName: string;
  issuedAt: Date;
  serial: string;
  colors: BrandColors;
};

// A4 landscape, in points.
const WIDTH = 842;
const HEIGHT = 595;
const MARGIN = 72;
const MIN_SIZE = 12;

type Color = ReturnType<typeof rgb>;

function color(colors: BrandColors, key: keyof BrandColors): Color {
  const c = parseColor(colors[key]) ?? parseColor(DEFAULT_BRAND[key]);
  return c ? rgb(c.r, c.g, c.b) : rgb(0, 0, 0);
}

// Standard fonts only encode WinAnsi. Anything else is drawn as '?'.
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

// Builds the completion certificate PDF in the space (or program) colours. pdf-lib types save()
// as Uint8Array<ArrayBufferLike>; the copy is ArrayBuffer-backed, which a Response body needs.
export async function certificatePdf(input: CertificateInput): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate of completion: ${input.programTitle}, ${input.memberName}`);
  doc.setAuthor(input.spaceName);
  doc.setCreationDate(input.issuedAt);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([WIDTH, HEIGHT]);

  const accent = color(input.colors, 'accent');
  const ink = color(input.colors, 'ink');
  const mid = color(input.colors, 'mid');
  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: color(input.colors, 'page') });
  page.drawRectangle({
    x: 24, y: 24, width: WIDTH - 48, height: HEIGHT - 48,
    borderColor: accent, borderWidth: 4, color: color(input.colors, 'card'),
  });

  centered(page, bold, input.spaceName, 480, 22, accent);
  centered(page, regular, 'Certificate of completion', 420, 30, ink);
  centered(page, regular, 'This certifies that', 360, 14, mid);
  centered(page, bold, input.memberName, 315, 28, ink);
  centered(page, regular, 'has completed', 270, 14, mid);
  centered(page, bold, input.programTitle, 225, 24, ink);
  centered(page, regular, formatDate(input.issuedAt), 130, 12, mid);
  centered(page, regular, `Certificate no. ${input.serial}`, 108, 10, mid);

  return new Uint8Array(await doc.save());
}
