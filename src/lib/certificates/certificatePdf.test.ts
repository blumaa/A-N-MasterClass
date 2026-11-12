import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { certificatePdf, type CertificateInput } from './certificatePdf';

const input: CertificateInput = {
  spaceName: 'Alexander',
  programTitle: 'Shibari 101',
  memberName: 'Sam Student',
  issuedAt: new Date('2026-11-12T12:00:00Z'),
  serial: 'c0ffee00-0000-4000-8000-000000000001',
  colors: DEFAULT_BRAND,
};

const load = async (bytes: Uint8Array) => PDFDocument.load(bytes, { updateMetadata: false });

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

  it('draws text the standard font cannot encode as ?, and fits long titles', async () => {
    const bytes = await certificatePdf({
      ...input,
      memberName: 'Ōno 緊縛 🎉',
      programTitle: 'A very long program title '.repeat(8),
      colors: { ...DEFAULT_BRAND, accent: 'not a colour' },
    });
    expect((await load(bytes)).getPageCount()).toBe(1);
  });
});
