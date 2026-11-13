// Community files against the linked project, as the service client (RLS: supabase/tests/140-community-files).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ATTACHMENT_INCOMPLETE, FILE_IN_USE, FILE_OUTSIDE_FOLDER, TOO_MANY_PHOTOS } from '@/lib/data/errors';
import { channelFolder } from '@/lib/storage/communityFiles';
import { createChatRepo } from './chat';
import { createCommunityFilesRepo } from './communityFiles';
import { createCoreRepo } from './core';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

const NOW = new Date('2026-11-12T10:00:00Z');

describe.skipIf(!contractEnabled)('community files repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let files: ReturnType<typeof createCommunityFilesRepo>;
  let chat: ReturnType<typeof createChatRepo>;
  let user: string;
  let feed: string;
  let chatChannel: string;
  let feedFolder: string;
  let chatFolder: string;

  beforeAll(async () => {
    fx = await createContractSpace('files');
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    files = createCommunityFilesRepo(ctx);
    chat = createChatRepo(ctx);
    user = await fx.newUser('u');
    const community = await createCoreRepo(ctx).createProduct({ spaceId: fx.spaceId, kind: 'community', slug: 'files-c', title: 'C' });
    const group = (await fx.admin.from('access_groups').select('id').eq('community_id', community.id).single()).data!.id;
    const mk = async (title: string, kind: 'chat' | 'feed') =>
      (await fx.admin.from('channels').insert({ community_id: community.id, access_group_id: group, title, kind }).select('id').single()).data!.id;
    feed = await mk('feed', 'feed');
    chatChannel = await mk('chat', 'chat');
    feedFolder = channelFolder(fx.spaceId, community.id, feed);
    chatFolder = channelFolder(fx.spaceId, community.id, chatChannel);
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  const photo = (path: string, thumbPath: string | null = null) => ({ path, thumbPath });
  const newPost = async () =>
    (await fx.admin.from('posts').insert({ channel_id: feed, author_id: user, body: 'p' }).select('id').single()).data!.id;

  it('post photos append in order, delete, and keep the folder and max rules', async () => {
    const post = await newPost();
    const added = await files.addPostPhotos(post, [photo(`${feedFolder}1-a.jpg`, `${feedFolder}1-t.jpg`), photo(`${feedFolder}2-b.gif`)]);
    expect(added.map((p) => [p.position, p.thumbPath])).toEqual([
      [0, `${feedFolder}1-t.jpg`],
      [1, null],
    ]);
    expect((await files.addPostPhotos(post, [photo(`${feedFolder}3-c.jpg`)]))[0]!.position).toBe(2);
    await files.deletePostPhoto(added[1]!.id);
    expect((await files.postPhotos([post])).map((p) => p.path)).toEqual([`${feedFolder}1-a.jpg`, `${feedFolder}3-c.jpg`]);
    expect(await files.postPhotos([])).toEqual([]);

    await expect(files.addPostPhotos(post, [photo(`${chatFolder}9-a.jpg`)])).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    await expect(files.addPostPhotos(post, [photo(`${feedFolder}9-a.jpg`, `${chatFolder}9-t.jpg`)])).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    await expect(files.addPostPhotos(await newPost(), [photo(`${feedFolder}1-a.jpg`)])).rejects.toThrow(FILE_IN_USE);
    await expect(files.addPostPhotos(await newPost(), [photo(`${feedFolder}8-a.jpg`, `${feedFolder}1-t.jpg`)])).rejects.toThrow(FILE_IN_USE);
    await files.addPostPhotos(post, Array.from({ length: 8 }, (_, i) => photo(`${feedFolder}${i + 10}-x.jpg`)));
    await expect(files.addPostPhotos(post, [photo(`${feedFolder}99-x.jpg`)])).rejects.toThrow(TOO_MANY_PHOTOS);
  });

  it('chat lines carry one attachment inside the channel folder', async () => {
    const line = (body: string, path: string, name = 'Notes.pdf') =>
      chat.createMessage({
        channelId: chatChannel,
        threadId: null,
        authorId: user,
        body,
        attachment: { path, name, type: 'application/pdf', size: 1200 },
        createdAt: NOW,
      });
    const row = await line('', `${chatFolder}1-notes.pdf`);
    expect((await chat.message(row.id))?.attachment).toEqual({ path: `${chatFolder}1-notes.pdf`, name: 'Notes.pdf', type: 'application/pdf', size: 1200 });
    await expect(line('x', `${feedFolder}2-a.pdf`)).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    await expect(line('x', `${chatFolder}3-a.pdf`, ' ')).rejects.toThrow(ATTACHMENT_INCOMPLETE);
    expect((await chat.createMessage({ channelId: chatChannel, threadId: null, authorId: user, body: 'hi', createdAt: NOW })).attachment).toBeNull();
  });
});
