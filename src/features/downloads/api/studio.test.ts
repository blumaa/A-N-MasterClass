import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { editDownloads, studioDownloads, type DownloadCommand } from './studio';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;
const run = async (c: DownloadCommand, who: string | null = SEED_IDS.assistant) => editDownloads(repo, await as(who), c, NOW);
const FILE = { productId: SEED_IDS.downloads, title: 'Futomomo', filePath: 'pattern-pack/futomomo.pdf', sizeBytes: 900 };

describe('studioDownloads', () => {
  it('lists download products with their files for editors only', async () => {
    const s = (await studioDownloads(repo, await as(SEED_IDS.assistant)))!;
    expect(s.downloads.map((d) => [d.product.slug, d.files.length])).toEqual([['pattern-pack', 2]]);
    expect(await studioDownloads(repo, await as(SEED_IDS.student))).toBeNull();
  });
});

describe('editDownloads', () => {
  it('creates a download product as a draft', async () => {
    const r = await run({ op: 'createDownload', title: 'Knot Sheets', slug: 'knot-sheets' });
    expect(await repo.product(r.ok ? r.id! : '')).toMatchObject({ kind: 'download', status: 'draft' });
  });

  it('adds, renames and deletes files', async () => {
    const r = await run({ op: 'addFile', ...FILE });
    const id = r.ok ? r.id! : '';
    expect(await repo.productFile(id)).toMatchObject({ title: 'Futomomo', createdAt: NOW });
    expect(await run({ op: 'renameFile', fileId: id, title: 'Futomomo tie' })).toEqual({ ok: true });
    expect((await repo.productFile(id))!.title).toBe('Futomomo tie');
    expect(await run({ op: 'deleteFile', fileId: id })).toEqual({ ok: true });
    expect(await repo.productFile(id)).toBeNull();
  });

  it('reports invalid input', async () => {
    expect(await run({ op: 'addFile', ...FILE, title: ' ' })).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('refuses students and rows outside the space or of another kind', async () => {
    expect(await run({ op: 'addFile', ...FILE }, SEED_IDS.student)).toEqual({ ok: false, error: 'forbidden' });
    expect(await run({ op: 'addFile', ...FILE, productId: SEED_IDS.podcast })).toEqual({ ok: false, error: 'not_found' });
    expect(await run({ op: 'renameFile', fileId: 'nope', title: 'x' })).toEqual({ ok: false, error: 'not_found' });
    const other = await resolveViewer(repo, 'natasha', SEED_IDS.natashaOwner);
    expect(await editDownloads(repo, other!, { op: 'deleteFile', fileId: 'file-hip-harness' }, NOW)).toEqual({ ok: false, error: 'not_found' });
  });
});
