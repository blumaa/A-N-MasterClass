import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { clientDownloads, fileDownload, myDownloads } from './files';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;

describe('clientDownloads', () => {
  it('lists the files of a held product, oldest first, with type and size', async () => {
    const d = (await clientDownloads(repo, await as(SEED_IDS.student), 'pattern-pack', NOW))!;
    expect(d.hasAccess).toBe(true);
    expect(d.files).toEqual([
      { id: 'file-single-column', title: 'Single column tie', type: 'PDF', size: '1.2 MB' },
      { id: 'file-hip-harness', title: 'Hip harness', type: 'PDF', size: '2.4 MB' },
    ]);
  });

  it('hides files without access, shows them to staff, and hides other kinds', async () => {
    expect(await clientDownloads(repo, await as(null), 'pattern-pack', NOW)).toMatchObject({ hasAccess: false, files: [] });
    expect((await clientDownloads(repo, await as(SEED_IDS.assistant), 'pattern-pack', NOW))!.files).toHaveLength(2);
    expect(await clientDownloads(repo, await as(SEED_IDS.student), 'rope-talk', NOW)).toBeNull();
  });
});

describe('fileDownload', () => {
  it('gives the storage path and a download name to holders and staff', async () => {
    const r = await fileDownload(repo, await as(SEED_IDS.student), 'pattern-pack', 'file-hip-harness', NOW);
    expect(r).toEqual({ path: 'pattern-pack/hip-harness.pdf', name: 'Hip harness.pdf' });
    expect(await fileDownload(repo, await as(SEED_IDS.assistant), 'pattern-pack', 'file-hip-harness', NOW)).not.toBeNull();
  });

  it('refuses visitors, files of another product and unknown files', async () => {
    expect(await fileDownload(repo, await as(null), 'pattern-pack', 'file-hip-harness', NOW)).toBeNull();
    expect(await fileDownload(repo, await as(SEED_IDS.student), 'rope-talk', 'file-hip-harness', NOW)).toBeNull();
    expect(await fileDownload(repo, await as(SEED_IDS.student), 'pattern-pack', 'nope', NOW)).toBeNull();
  });
});

describe('myDownloads', () => {
  it('lists held download products', async () => {
    expect((await myDownloads(repo, await as(SEED_IDS.student), NOW)).map((p) => p.slug)).toEqual(['pattern-pack']);
    expect(await myDownloads(repo, await as(null), NOW)).toEqual([]);
  });
});
