// Signed-file routes: who may open a post photo or a chat file.
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { attachmentFile, postPhotoPath } from './fileAccess';

const NOW = new Date('2026-11-12T12:00:00Z');
const FOLDER = `${SEED_IDS.alexander}/${SEED_IDS.community}`;
let repo: FakeRepo;
let slug: string;
let postId: string;
let photoId: string;

const viewer = async (who: string | null, space = 'alexander') => (await resolveViewer(repo, space, who))!;
const file = (path: string) => ({ path, name: 'a.pdf', type: 'application/pdf', size: 3 });

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  slug = (await repo.product(SEED_IDS.community))!.slug;
  postId = (await repo.createPost({ channelId: SEED_IDS.general, authorId: SEED_IDS.student, body: 'hi', createdAt: NOW })).id;
  await repo.addPostPhotos(postId, [`${FOLDER}/${SEED_IDS.general}/u-a.jpg`]);
  photoId = (await repo.postPhotos([postId]))[0]!.id;
});

describe('postPhotoPath', () => {
  it('readers of the post get the path', async () => {
    expect(await postPhotoPath(repo, await viewer(SEED_IDS.student), slug, postId, photoId, NOW)).toBe(`${FOLDER}/${SEED_IDS.general}/u-a.jpg`);
  });

  it('null for outsiders, other spaces, a wrong slug or post, and hidden posts for non-moderators', async () => {
    expect(await postPhotoPath(repo, await viewer(null), slug, postId, photoId, NOW)).toBeNull();
    expect(await postPhotoPath(repo, await viewer(SEED_IDS.assistant), slug, postId, photoId, NOW)).toBeNull();
    expect(await postPhotoPath(repo, await viewer(SEED_IDS.student, 'natasha'), slug, postId, photoId, NOW)).toBeNull();
    expect(await postPhotoPath(repo, await viewer(SEED_IDS.student), 'other', postId, photoId, NOW)).toBeNull();
    expect(await postPhotoPath(repo, await viewer(SEED_IDS.student), slug, 'nope', photoId, NOW)).toBeNull();
    await repo.updatePost(postId, { hiddenAt: NOW });
    expect(await postPhotoPath(repo, await viewer(SEED_IDS.student), slug, postId, photoId, NOW)).toBeNull();
    expect(await postPhotoPath(repo, await viewer(SEED_IDS.alexanderOwner), slug, postId, photoId, NOW)).not.toBeNull();
  });
});

describe('attachmentFile', () => {
  it('channel files for channel readers', async () => {
    const a = file(`${FOLDER}/${SEED_IDS.lounge}/u-a.pdf`);
    const m = await repo.createMessage({ channelId: SEED_IDS.lounge, threadId: null, authorId: SEED_IDS.student, body: '', attachment: a, createdAt: NOW });
    expect(await attachmentFile(repo, await viewer(SEED_IDS.student), slug, m.id, NOW)).toEqual(a);
    expect(await attachmentFile(repo, await viewer(SEED_IDS.assistant), slug, m.id, NOW)).toBeNull();
    expect(await attachmentFile(repo, await viewer(SEED_IDS.student), 'other', m.id, NOW)).toBeNull();
    expect(await attachmentFile(repo, await viewer(SEED_IDS.student), slug, 'msg-hello', NOW)).toBeNull();
  });

  it('DM files for the two people in the thread only', async () => {
    const thread = await repo.createDmThread(SEED_IDS.community, SEED_IDS.student, SEED_IDS.alexanderOwner);
    const a = file(`${FOLDER}/dm/${thread.id}/u-a.pdf`);
    const m = await repo.createMessage({ channelId: null, threadId: thread.id, authorId: SEED_IDS.student, body: '', attachment: a, createdAt: NOW });
    expect(await attachmentFile(repo, await viewer(SEED_IDS.alexanderOwner), slug, m.id, NOW)).toEqual(a);
    await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, true);
    expect(await attachmentFile(repo, await viewer(SEED_IDS.assistant), slug, m.id, NOW)).toBeNull();
  });
});
