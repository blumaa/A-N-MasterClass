import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
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

const as = async (profileId: string | null): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;
const finish = async () => {
  for (const s of ALL_STEPS) await repo.setStepComplete(SEED_IDS.student, s, true);
};

describe('programCertificate (G26)', () => {
  it('is null while certificates are off or the program is unfinished', async () => {
    await finish();
    expect(await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW)).toBeNull();
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await repo.setStepComplete(SEED_IDS.student, 'step-replay', false);
    expect(await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW)).toBeNull();
  });

  it('is null for visitors and for staff without a grant', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    expect(await programCertificate(repo, await as(null), 'shibari-101', NOW)).toBeNull();
    expect(await programCertificate(repo, await as(SEED_IDS.assistant), 'shibari-101', NOW)).toBeNull();
  });

  it('issues once and returns the same PDF serial on a second download', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await finish();
    const first = (await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW))!;
    expect(first.filename).toBe('shibari-101-certificate.pdf');
    const doc = await PDFDocument.load(first.pdf, { updateMetadata: false });
    expect(doc.getTitle()).toMatch(/^Certificate of completion: /);
    expect(doc.getAuthor()).toBe('Alexander');
    const second = (await programCertificate(repo, await as(SEED_IDS.student), 'shibari-101', NOW))!;
    expect(second.serial).toBe(first.serial);
  });
});
