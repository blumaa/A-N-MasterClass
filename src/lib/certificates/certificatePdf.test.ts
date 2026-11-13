import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { certificateFonts, type CertificateFonts } from './certificateFonts';
import { certificatePdf, type CertificateInput } from './certificatePdf';

// 1x1 PNG.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
const WEBP = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');

let fonts: CertificateFonts;
let input: CertificateInput;
beforeAll(async () => {
  fonts = await certificateFonts({ heading: null, body: null });
  input = {
    spaceName: 'Alexander',
    programTitle: 'Shibari 101',
    memberName: 'Sam Student',
    issuedAt: new Date('2026-11-12T12:00:00Z'),
    serial: 'c0ffee00-0000-4000-8000-000000000001',
    colors: DEFAULT_BRAND,
    fonts,
    logo: null,
  };
});

const load = async (bytes: Uint8Array) => PDFDocument.load(bytes, { updateMetadata: false });

const dicts = (doc: PDFDocument) =>
  doc.context
    .enumerateIndirectObjects()
    .flatMap(([, obj]) => (obj instanceof PDFDict ? [obj] : obj instanceof PDFRawStream ? [obj.dict] : []));
const fontNames = (doc: PDFDocument) =>
  dicts(doc)
    .filter((d) => d.get(PDFName.of('Type'))?.toString() === '/FontDescriptor')
    .map((d) => d.get(PDFName.of('FontName'))!.toString());
const images = (doc: PDFDocument) => dicts(doc).filter((d) => d.get(PDFName.of('Subtype'))?.toString() === '/Image');

describe('certificatePdf', () => {
  it('builds a one-page landscape PDF titled for the member and program', async () => {
    const bytes = await certificatePdf(input);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    expect(doc.getTitle()).toBe('Certificate of completion: Shibari 101, Sam Student');
    expect(doc.getAuthor()).toBe('Alexander');
  });

  it('embeds the brand heading and body fonts, subset', async () => {
    const branded = await certificateFonts({ heading: 'playfair-display', body: 'dm-sans' });
    const bytes = await certificatePdf({ ...input, fonts: branded });
    const names = fontNames(await load(bytes));
    expect(names).toHaveLength(2);
    expect(names.some((n) => n.startsWith('/PlayfairDisplay-Bold'))).toBe(true);
    expect(names.some((n) => n.startsWith('/DMSans-Regular'))).toBe(true);
    // Subset: the two TTFs total about 170 KB; only used glyphs ship.
    expect(bytes.length).toBeLessThan(60_000);
  });

  it('draws a PNG or JPEG logo; anything else falls back to the space name', async () => {
    // PNG alpha adds a soft-mask image.
    expect(images(await load(await certificatePdf({ ...input, logo: PNG }))).length).toBeGreaterThan(0);
    expect(images(await load(await certificatePdf({ ...input, logo: WEBP })))).toHaveLength(0);
    expect(images(await load(await certificatePdf(input)))).toHaveLength(0);
  });

  it('prints accents the font covers, ? for the rest, and fits long titles', async () => {
    const bytes = await certificatePdf({
      ...input,
      memberName: 'Ōno Zoë 緊縛 🎉',
      programTitle: 'A very long program title '.repeat(8),
      colors: { ...DEFAULT_BRAND, accent: 'not a colour' },
    });
    expect((await load(bytes)).getPageCount()).toBe(1);
  });
});
