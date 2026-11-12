import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from '@/lib/storage/fileStore';
import { requestCommunityUpload, type CommunityUploadRequest } from './uploads';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const FOLDER = `${SEED_IDS.alexander}/${SEED_IDS.community}`;
const PHOTO: CommunityUploadRequest = { target: 'channel', id: SEED_IDS.general, fileName: 'Rope.JPG', type: 'image/jpeg', sizeBytes: 900 };
const PDF: CommunityUploadRequest = { target: 'channel', id: SEED_IDS.lounge, fileName: 'Notes.pdf', type: 'application/pdf', sizeBytes: 900 };

const ask = async (req: CommunityUploadRequest, who: string | null = SEED_IDS.student, space = 'alexander') =>
  requestCommunityUpload(repo, createFakeFileStore(() => NOW, 'community'), (await resolveViewer(repo, space, who))!, req, () => 'u1', NOW);

describe('requestCommunityUpload', () => {
  it('feed channel: photos into the channel folder', async () => {
    const r = await ask(PHOTO);
    expect(r).toMatchObject({ ok: true, path: `${FOLDER}/${SEED_IDS.general}/u1-rope.jpg` });
    expect(r.ok && new URL(r.uploadUrl).pathname).toContain('/upload/community/');
    expect(await ask({ ...PHOTO, type: 'application/pdf', fileName: 'a.pdf' })).toEqual({
      ok: false,
      message: 'Photos must be JPEG, PNG, WebP or GIF images.',
    });
  });

  it('chat channel: common files into the channel folder', async () => {
    expect(await ask(PDF)).toMatchObject({ ok: true, path: `${FOLDER}/${SEED_IDS.lounge}/u1-notes.pdf` });
    expect(await ask({ ...PDF, type: 'application/x-msdownload' })).toEqual({ ok: false, message: 'This file type is not allowed.' });
    expect(await ask({ ...PDF, sizeBytes: 0 })).toEqual({ ok: false, message: 'The file is empty.' });
  });

  it('needs the right to post there', async () => {
    await repo.updateChannel(SEED_IDS.lounge, { readOnly: true });
    expect(await ask(PDF)).toMatchObject({ ok: false });
    expect(await ask(PDF, SEED_IDS.alexanderOwner)).toMatchObject({ ok: true });
    expect(await ask(PDF, null)).toMatchObject({ ok: false });
    expect(await ask(PDF, SEED_IDS.natashaOwner, 'natasha')).toMatchObject({ ok: false });
  });

  it('DM thread: files into the thread folder while the viewer may reply', async () => {
    const thread = await repo.createDmThread(SEED_IDS.community, SEED_IDS.student, SEED_IDS.alexanderOwner);
    const dm = { ...PDF, target: 'thread' as const, id: thread.id };
    expect(await ask(dm)).toMatchObject({ ok: true, path: `${FOLDER}/dm/${thread.id}/u1-notes.pdf` });
    expect(await ask(dm, SEED_IDS.assistant)).toMatchObject({ ok: false });
    await repo.setBlock({ communityId: SEED_IDS.community, blockerId: SEED_IDS.alexanderOwner, blockedId: SEED_IDS.student }, true);
    expect(await ask(dm)).toMatchObject({ ok: false });
  });

  it('rejects a malformed request (action arguments are untrusted)', async () => {
    expect(await ask({ ...PDF, target: 'post' as never })).toMatchObject({ ok: false });
    expect(await ask({ ...PDF, sizeBytes: 1.5 })).toMatchObject({ ok: false });
    expect(await ask({ ...PDF, type: 7 as never })).toMatchObject({ ok: false });
  });
});
