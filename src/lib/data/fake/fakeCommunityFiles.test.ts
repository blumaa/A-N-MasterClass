import { beforeEach, describe, expect, it } from 'vitest';
import { channelFolder, threadFolder } from '@/lib/storage/communityFiles';
import { ATTACHMENT_INCOMPLETE, FILE_IN_USE, FILE_OUTSIDE_FOLDER, TOO_MANY_PHOTOS } from '../errors';
import { bodyRangeMessage, MESSAGE_MAX } from '../limits';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-12T12:00:00Z');
let repo: FakeRepo;
let communityId: string;
let feedId: string;
let chatId: string;
let folder: string;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  communityId = (await repo.createProduct({ spaceId: SEED_IDS.alexander, kind: 'community', slug: 'files', title: 'Files' })).id;
  const accessGroupId = (await repo.accessGroups(communityId))[0]!.id;
  const channel = { communityId, accessGroupId, privacy: 'public', readOnly: false } as const;
  feedId = (await repo.createChannel({ ...channel, title: 'Feed', kind: 'feed' })).id;
  chatId = (await repo.createChannel({ ...channel, title: 'Chat', kind: 'chat' })).id;
  folder = channelFolder(SEED_IDS.alexander, communityId, feedId);
});

const newPost = () => repo.createPost({ channelId: feedId, authorId: SEED_IDS.student, body: 'Hi', createdAt: NOW });
const file = (path: string, name = 'a.pdf') => ({ path, name, type: 'application/pdf', size: 10 });

describe('post photos', () => {
  it('append in order, read by post, delete one', async () => {
    const post = await newPost();
    await repo.addPostPhotos(post.id, [`${folder}1-a.jpg`, `${folder}2-b.jpg`]);
    const [c] = await repo.addPostPhotos(post.id, [`${folder}3-c.jpg`]);
    expect(c!.position).toBe(2);
    const b = (await repo.postPhotos([post.id]))[1];
    expect((await repo.postPhotos([post.id])).map((p) => p.position)).toEqual([0, 1, 2]);
    await repo.deletePostPhoto(b!.id);
    expect((await repo.postPhotos([post.id])).map((p) => p.path)).toEqual([`${folder}1-a.jpg`, `${folder}3-c.jpg`]);
  });

  it('stay in the channel folder, unique, max 10', async () => {
    const post = await newPost();
    const chatFolder = channelFolder(SEED_IDS.alexander, communityId, chatId);
    await expect(repo.addPostPhotos(post.id, [`${chatFolder}1-a.jpg`])).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    await expect(repo.addPostPhotos(post.id, [`${folder}x/1-a.jpg`])).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    const ten = Array.from({ length: 10 }, (_, i) => `${folder}${i}-a.jpg`);
    await repo.addPostPhotos(post.id, ten);
    await expect(repo.addPostPhotos(post.id, [`${folder}x-a.jpg`])).rejects.toThrow(TOO_MANY_PHOTOS);
    const other = await newPost();
    await expect(repo.addPostPhotos(other.id, [`${folder}0-a.jpg`])).rejects.toThrow(FILE_IN_USE);
  });

  it('go with the post and the channel; channelFiles lists them', async () => {
    const post = await newPost();
    await repo.addPostPhotos(post.id, [`${folder}1-a.jpg`]);
    expect(await repo.channelFiles(feedId)).toEqual([`${folder}1-a.jpg`]);
    await repo.deletePost(post.id);
    expect(await repo.postPhotos([post.id])).toEqual([]);
    expect(await repo.channelFiles(feedId)).toEqual([]);
  });
});

describe('chat attachments', () => {
  const chatLine = (body: string, attachment: ReturnType<typeof file> | null) =>
    repo.createMessage({ channelId: chatId, threadId: null, authorId: SEED_IDS.student, body, attachment, createdAt: NOW });

  it('a line is text, a file, or both; file stays in the channel or thread folder', async () => {
    const chatFolder = channelFolder(SEED_IDS.alexander, communityId, chatId);
    const line = await chatLine('', file(`${chatFolder}1-a.pdf`));
    expect(line.attachment).toEqual(file(`${chatFolder}1-a.pdf`));
    expect((await chatLine('hi', null)).attachment).toBeNull();
    await expect(chatLine(' ', null)).rejects.toThrow(bodyRangeMessage(MESSAGE_MAX));
    await expect(chatLine('x', file(`${folder}2-a.pdf`))).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    await expect(chatLine('x', { ...file(`${chatFolder}3-a.pdf`), name: ' ' })).rejects.toThrow(ATTACHMENT_INCOMPLETE);
    await expect(chatLine('x', file(`${chatFolder}1-a.pdf`))).rejects.toThrow(FILE_IN_USE);
    expect(await repo.channelFiles(chatId)).toEqual([`${chatFolder}1-a.pdf`]);

    const thread = await repo.createDmThread(communityId, SEED_IDS.student, SEED_IDS.alexanderOwner);
    const dmFolder = threadFolder(SEED_IDS.alexander, communityId, thread.id);
    const dm = (path: string) =>
      repo.createMessage({ channelId: null, threadId: thread.id, authorId: SEED_IDS.student, body: '', attachment: file(path), createdAt: NOW });
    await expect(dm(`${chatFolder}4-a.pdf`)).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    expect((await dm(`${dmFolder}4-a.pdf`)).attachment?.path).toBe(`${dmFolder}4-a.pdf`);
  });
});
