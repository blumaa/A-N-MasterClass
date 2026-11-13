import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { programCertificate } from './certificate';

const NOW = new Date('2026-11-10T12:00:00Z');
const ALL_STEPS = ['step-intro', 'step-safety', 'step-single-column', 'step-double-column', 'step-week2', 'step-replay'];
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const NO_LOGO = async (): Promise<Uint8Array | null> => null;
// 1x1 PNG.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
const pdfDicts = (doc: PDFDocument) =>
  doc.context
    .enumerateIndirectObjects()
    .flatMap(([, o]) => (o instanceof PDFDict ? [o] : o instanceof PDFRawStream ? [o.dict] : []))
    .map((d) => [d.get(PDFName.of('FontName'))?.toString(), d.get(PDFName.of('Subtype'))?.toString()]);

const as = async (profileId: string | null): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;
const finish = async () => {
  for (const s of ALL_STEPS) await repo.setStepComplete(SEED_IDS.student, s, true);
};

describe('programCertificate (G26)', () => {
  it('is null while certificates are off or the program is unfinished', async () => {
    await finish();
    expect(await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW, NO_LOGO)).toBeNull();
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await repo.setStepComplete(SEED_IDS.student, 'step-replay', false);
    expect(await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW, NO_LOGO)).toBeNull();
  });

  it('is null for visitors and for staff without a grant', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    expect(await programCertificate(repo, await as(null), 'shibari-101', NOW, NO_LOGO)).toBeNull();
    expect(await programCertificate(repo, await as(SEED_IDS.assistant), 'shibari-101', NOW, NO_LOGO)).toBeNull();
  });

  it('issues once and returns the same PDF serial on a second download', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await finish();
    const first = (await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW, NO_LOGO))!;
    expect(first.filename).toBe('shibari-101-certificate.pdf');
    const doc = await PDFDocument.load(first.pdf, { updateMetadata: false });
    expect(doc.getTitle()).toMatch(/^Certificate of completion: /);
    expect(doc.getAuthor()).toBe('Alexander');
    const second = (await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW, NO_LOGO))!;
    expect(second.serial).toBe(first.serial);
  });

  it('draws the space logo and brand fonts', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await repo.saveBranding({
      spaceId: SEED_IDS.alexander,
      colors: null,
      fontHeading: 'fraunces',
      fontBody: 'source-sans-3',
      logoPath: `${SEED_IDS.alexander}/site/logo.png`,
      faviconPath: null,
    });
    await finish();
    const logo = vi.fn(async () => PNG);
    const file = (await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW, logo))!;
    expect(logo).toHaveBeenCalledWith(`${SEED_IDS.alexander}/site/logo.png`);
    const found = pdfDicts(await PDFDocument.load(file.pdf, { updateMetadata: false }));
    expect(found.some(([font]) => font?.startsWith('/Fraunces'))).toBe(true);
    expect(found.some(([font]) => font?.startsWith('/SourceSans3'))).toBe(true);
    expect(found.some(([, sub]) => sub === '/Image')).toBe(true);
  });

  it('skips the logo fetch when the space has none', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await finish();
    const logo = vi.fn(NO_LOGO);
    expect(await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW, logo)).not.toBeNull();
    expect(logo).not.toHaveBeenCalled();
  });
});

