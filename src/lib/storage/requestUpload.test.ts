import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { EPISODE_MAX_BYTES } from '@/lib/data/types';
import { createFakeFileStore } from './fileStore';
import { requestUpload, type UploadRequest } from './requestUpload';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const PDF: UploadRequest = { productId: SEED_IDS.downloads, kind: 'download', fileName: 'Hip Harness.pdf', sizeBytes: 900 };
const MP3: UploadRequest = { productId: SEED_IDS.podcast, kind: 'podcast', fileName: 'Ep 1.MP3', sizeBytes: 900 };

const ask = async (req: UploadRequest, who: string | null = SEED_IDS.assistant, space = 'alexander') =>
  requestUpload(repo, createFakeFileStore(), (await resolveViewer(repo, space, who))!, req, () => 'u1');

describe('requestUpload', () => {
  it('signs an upload into <space>/<product>/ for editors', async () => {
    const r = await ask(PDF);
    expect(r).toMatchObject({ ok: true, path: `${SEED_IDS.alexander}/${SEED_IDS.downloads}/u1-hip-harness.pdf` });
    expect(r.ok && new URL(r.uploadUrl).pathname).toContain('/upload/resources/');
    expect(await ask(MP3)).toMatchObject({ ok: true, path: `${SEED_IDS.alexander}/${SEED_IDS.podcast}/u1-ep-1.mp3` });
  });

  it('signs an upload into a program folder (download parts)', async () => {
    expect(await ask({ ...PDF, productId: SEED_IDS.program, kind: 'program' })).toMatchObject({
      ok: true,
      path: `${SEED_IDS.alexander}/${SEED_IDS.program}/u1-hip-harness.pdf`,
    });
    expect(await ask({ ...PDF, productId: SEED_IDS.program, kind: 'program' }, SEED_IDS.student)).toMatchObject({ ok: false });
    expect(await ask({ ...PDF, productId: SEED_IDS.program })).toMatchObject({ ok: false });
  });

  it('refuses viewers without products.edit', async () => {
    expect(await ask(PDF, SEED_IDS.student)).toMatchObject({ ok: false });
    expect(await ask(PDF, null)).toMatchObject({ ok: false });
  });

  it('refuses a product of another space or kind', async () => {
    expect(await ask({ ...PDF, productId: SEED_IDS.podcast })).toEqual({ ok: false, message: 'Not found. It may have been deleted.' });
    expect(await ask(PDF, SEED_IDS.natashaOwner, 'natasha')).toMatchObject({ ok: false, message: 'Not found. It may have been deleted.' });
  });

  it('checks size and the mp3 rule for podcasts', async () => {
    expect(await ask({ ...PDF, sizeBytes: 0 })).toMatchObject({ ok: false, message: 'The file is empty.' });
    expect(await ask({ ...MP3, sizeBytes: EPISODE_MAX_BYTES + 1 })).toMatchObject({ ok: false, message: expect.stringContaining('too large') });
    expect(await ask({ ...MP3, fileName: 'ep.wav' })).toEqual({ ok: false, message: 'Podcast audio must be an .mp3 file.' });
  });

  it('rejects a malformed request (action arguments are untrusted)', async () => {
    expect(await ask({ ...PDF, kind: 'community' as never })).toMatchObject({ ok: false });
    expect(await ask({ ...PDF, sizeBytes: 1.5 })).toMatchObject({ ok: false });
    expect(await ask({ ...PDF, fileName: 7 as never })).toMatchObject({ ok: false });
  });
});
