import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from './fileStore';
import { requestAvatarUpload, requestSiteImageUpload, type SiteImageRequest } from './requestSiteImageUpload';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const JPG: SiteImageRequest = { fileName: 'Studio Hero.jpg', sizeBytes: 900 };

const ask = async (req: SiteImageRequest, who: string | null = SEED_IDS.assistant, space = 'alexander') =>
  requestSiteImageUpload(createFakeFileStore(undefined, 'site'), (await resolveViewer(repo, space, who))!, req, () => 'u1');

describe('requestSiteImageUpload', () => {
  it('signs an upload into <space>/site/ for site editors', async () => {
    const r = await ask(JPG);
    expect(r).toMatchObject({ ok: true, path: `${SEED_IDS.alexander}/site/u1-studio-hero.jpg` });
    expect(r.ok && new URL(r.uploadUrl).pathname).toContain('/upload/site/');
  });

  it('refuses viewers without site.edit', async () => {
    expect(await ask(JPG, SEED_IDS.student)).toMatchObject({ ok: false });
    expect(await ask(JPG, null)).toMatchObject({ ok: false });
  });

  it('checks type and size', async () => {
    expect(await ask({ ...JPG, fileName: 'a.gif' })).toMatchObject({ ok: false, message: expect.stringContaining('WebP') });
    expect(await ask({ ...JPG, sizeBytes: 0 })).toMatchObject({ ok: false, message: 'The file is empty.' });
  });

  it('rejects a malformed request (action arguments are untrusted)', async () => {
    expect(await ask({ ...JPG, sizeBytes: 1.5 })).toMatchObject({ ok: false });
    expect(await ask({ ...JPG, fileName: 7 as never })).toMatchObject({ ok: false });
    expect(await ask(null as never)).toMatchObject({ ok: false });
  });
});

describe('requestAvatarUpload', () => {
  const avatar = async (req: SiteImageRequest, who: string | null) =>
    requestAvatarUpload(createFakeFileStore(undefined, 'site'), (await resolveViewer(repo, 'alexander', who))!, req, () => 'u1');

  it('signs an upload into the member own avatar folder', async () => {
    expect(await avatar({ fileName: 'Me.png', sizeBytes: 900 }, SEED_IDS.student)).toMatchObject({
      ok: true,
      path: `${SEED_IDS.alexander}/avatars/${SEED_IDS.student}/u1-me.png`,
    });
  });

  it('refuses visitors and bad files', async () => {
    expect(await avatar(JPG, null)).toMatchObject({ ok: false });
    expect(await avatar({ ...JPG, fileName: 'a.gif' }, SEED_IDS.student)).toMatchObject({ ok: false });
    expect(await avatar(null as never, SEED_IDS.student)).toMatchObject({ ok: false });
  });
});
