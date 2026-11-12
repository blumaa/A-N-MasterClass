// Files through the member commands: post photos, chat attachments, cleanup on delete.
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from '@/lib/storage/fileStore';
import { chatCommand, type ChatCommand } from './chat';
import { attachmentHref, postPhotoHref } from '../paths';
import { communityCommand, type CommunityCommand } from './commands';
import { communityPage, postPage } from './feed';
import { reportCommand } from './reports';
import { editCommunity } from './studio';

const NOW = new Date('2026-11-10T12:00:00Z');
const FOLDER = `${SEED_IDS.alexander}/${SEED_IDS.community}`;
const FEED = `${FOLDER}/${SEED_IDS.general}/`;
const CHAT = `${FOLDER}/${SEED_IDS.lounge}/`;
let repo: FakeRepo;
let files: ReturnType<typeof createFakeFileStore>;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
  files = createFakeFileStore(() => NOW, 'community');
});

const viewer = async (who: string) => (await resolveViewer(repo, 'alexander', who))!;
const post = async (who: string, cmd: CommunityCommand) => communityCommand(repo, files, await viewer(who), cmd, NOW, async () => true);
const chat = async (who: string, cmd: ChatCommand) => chatCommand(repo, files, await viewer(who), cmd, NOW);
const id = (r: { ok: boolean; id?: string }): string => {
  if (!r.ok || !r.id) throw new Error(`expected id, got ${JSON.stringify(r)}`);
  return r.id;
};
const photos = (n: number, folder = FEED) => Array.from({ length: n }, (_, i) => `${folder}p${i}-a.jpg`);
const photoPaths = () => repo.db.postPhotos.map((p) => p.path);

describe('post photos', () => {
  it('a post keeps its photos in order', async () => {
    const postId = id(await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'hi', photos: photos(2) }));
    expect((await repo.postPhotos([postId])).map((p) => p.path)).toEqual(photos(2));
  });

  it('refuses photos outside the channel folder or over the cap, before writing the post', async () => {
    const outside = await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'x', photos: photos(1, CHAT) });
    expect(outside).toMatchObject({ ok: false, error: 'invalid' });
    const many = await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'x', photos: photos(11) });
    expect(many).toEqual({ ok: false, error: 'invalid', message: 'A post takes up to 10 photos.' });
    expect(repo.db.posts.filter((p) => p.body === 'x')).toEqual([]);
  });

  it('the author adds photos later; others may not', async () => {
    const postId = id(await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'hi' }));
    expect((await post(SEED_IDS.student, { op: 'addPostPhotos', postId, photos: photos(1) })).ok).toBe(true);
    expect(await post(SEED_IDS.alexanderOwner, { op: 'addPostPhotos', postId, photos: [`${FEED}z-a.jpg`] })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(photoPaths()).toEqual(photos(1));
  });

  it('removing a photo deletes the row, then the object', async () => {
    const postId = id(await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'hi', photos: photos(2) }));
    const [first] = await repo.postPhotos([postId]);
    expect((await post(SEED_IDS.alexanderOwner, { op: 'removePostPhoto', postId, photoId: first!.id })).ok).toBe(true);
    expect(photoPaths()).toEqual([photos(2)[1]]);
    expect(files.removed).toEqual([photos(2)[0]]);
    expect(await post(SEED_IDS.student, { op: 'removePostPhoto', postId, photoId: 'nope' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('deleting a post removes its photo objects', async () => {
    const postId = id(await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'hi', photos: photos(2) }));
    expect((await post(SEED_IDS.student, { op: 'deletePost', postId })).ok).toBe(true);
    expect(files.removed).toEqual(photos(2));
    expect(photoPaths()).toEqual([]);
  });
});

describe('chat attachments', () => {
  const pdf = { path: `${CHAT}u1-notes.pdf`, name: 'Notes.pdf', type: 'application/pdf', size: 1200 };

  it('a line may carry one file and no text', async () => {
    const messageId = id(await chat(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: '', attachment: pdf }));
    expect((await repo.message(messageId))?.attachment).toEqual(pdf);
  });

  it('refuses a disallowed type or a file outside the folder', async () => {
    const exe = { ...pdf, type: 'application/x-msdownload' };
    expect(await chat(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'x', attachment: exe })).toEqual({
      ok: false,
      error: 'invalid',
      message: 'This file type is not allowed.',
    });
    const away = { ...pdf, path: `${FEED}u1-notes.pdf` };
    expect(await chat(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'x', attachment: away })).toMatchObject({
      ok: false,
      error: 'invalid',
    });
  });

  it('deleting a line removes its file', async () => {
    const messageId = id(await chat(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'x', attachment: pdf }));
    expect((await chat(SEED_IDS.student, { op: 'deleteMessage', messageId })).ok).toBe(true);
    expect(files.removed).toEqual([pdf.path]);
  });

  it('DM lines take files in the thread folder', async () => {
    const threadId = id(await chat(SEED_IDS.student, { op: 'startDm', communityId: SEED_IDS.community, recipientId: SEED_IDS.alexanderOwner }));
    const file = { ...pdf, path: `${FOLDER}/dm/${threadId}/u1-notes.pdf` };
    const messageId = id(await chat(SEED_IDS.student, { op: 'sendDm', threadId, body: '', attachment: file }));
    expect((await repo.message(messageId))?.attachment).toEqual(file);
    expect((await chat(SEED_IDS.student, { op: 'deleteMessage', messageId })).ok).toBe(true);
    expect(files.removed).toEqual([file.path]);
  });
});

describe('moderation cleanup', () => {
  const removeReported = async (targetType: 'post' | 'message', targetId: string) => {
    await reportCommand(repo, files, await viewer(SEED_IDS.student), { op: 'report', targetType, targetId, reason: null }, NOW);
    const reportId = repo.db.reports.at(-1)!.id;
    const action = { op: 'resolveReport', reportId, action: 'remove' } as const;
    expect((await reportCommand(repo, files, await viewer(SEED_IDS.alexanderOwner), action, NOW)).ok).toBe(true);
  };

  it('removing a reported post or line removes its files', async () => {
    const postId = id(await post(SEED_IDS.alexanderOwner, { op: 'createPost', channelId: SEED_IDS.general, body: 'hi', photos: photos(1) }));
    await removeReported('post', postId);
    const file = { path: `${CHAT}u1-a.pdf`, name: 'a.pdf', type: 'application/pdf', size: 3 };
    const messageId = id(await chat(SEED_IDS.alexanderOwner, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: '', attachment: file }));
    await removeReported('message', messageId);
    expect(files.removed).toEqual([...photos(1), file.path]);
  });

  it('deleting a channel in Studio removes its files', async () => {
    await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'hi', photos: photos(2) });
    const cmd = { op: 'deleteChannel', channelId: SEED_IDS.general } as const;
    expect((await editCommunity(repo, files, await viewer(SEED_IDS.alexanderOwner), cmd, NOW)).ok).toBe(true);
    expect(files.removed).toEqual(photos(2));
  });
});

describe('file views', () => {
  const slug = async () => (await repo.product(SEED_IDS.community))!.slug;

  it('posts list their photos by signed route, in order', async () => {
    const postId = id(await post(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'hi', photos: photos(2) }));
    const [a, b] = await repo.postPhotos([postId]);
    const page = await communityPage(repo, await viewer(SEED_IDS.student), await slug(), SEED_IDS.general, NOW);
    const item = page?.kind === 'open' ? page.posts.find((p) => p.id === postId) : undefined;
    expect(item?.photos).toEqual([
      { id: a!.id, href: postPhotoHref(await slug(), postId, a!.id) },
      { id: b!.id, href: postPhotoHref(await slug(), postId, b!.id) },
    ]);
    expect((await postPage(repo, await viewer(SEED_IDS.student), await slug(), postId, NOW))?.post.photos).toHaveLength(2);
  });

  it('chat lines show their file: images inline, others as a link', async () => {
    const png = { path: `${CHAT}u1-a.png`, name: 'a.png', type: 'image/png', size: 5 };
    const messageId = id(await chat(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: '', attachment: png }));
    const page = await communityPage(repo, await viewer(SEED_IDS.student), await slug(), SEED_IDS.lounge, NOW);
    const lines = page?.kind === 'open' ? page.messages : [];
    expect(lines.find((m) => m.id === messageId)?.attachment).toEqual({
      name: 'a.png',
      type: 'image/png',
      size: 5,
      image: true,
      href: attachmentHref(await slug(), messageId),
    });
    expect(lines.find((m) => m.id === 'msg-hello')?.attachment).toBeNull();
  });
});
