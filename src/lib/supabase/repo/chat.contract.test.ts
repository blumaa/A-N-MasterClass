// Chat Supabase repo against the linked project, as the service client (RLS is covered by the SQL suites).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConstraintError } from '@/lib/data/errors';
import { createChatRepo, type ChatRepo } from './chat';
import { createCoreRepo } from './core';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

const T0 = new Date('2026-01-01T10:00:00Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);

describe.skipIf(!contractEnabled)('chat repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let repo: ChatRepo;
  let communityId: string;
  let chatChannel: string;
  let feedChannel: string;
  let groupId: string;
  let u1: string, u2: string, u3: string;

  beforeAll(async () => {
    fx = await createContractSpace('chat');
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    repo = createChatRepo(ctx);
    [u1, u2, u3] = await Promise.all([fx.newUser('u1'), fx.newUser('u2'), fx.newUser('u3')]);
    const community = await createCoreRepo(ctx).createProduct({
      spaceId: fx.spaceId,
      kind: 'community',
      slug: 'chat-c',
      title: 'C',
    });
    communityId = community.id;
    // Products get a default access group by trigger; channels need one.
    const group = await fx.admin.from('access_groups').select('id').eq('community_id', communityId).single();
    if (group.error) throw group.error;
    groupId = group.data.id;
    const mk = async (title: string, kind: 'chat' | 'feed') => {
      const { data, error } = await fx.admin
        .from('channels')
        .insert({ community_id: communityId, access_group_id: groupId, title, kind })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    };
    chatChannel = await mk('chat', 'chat');
    feedChannel = await mk('feed', 'feed');
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  const msg = (over: Partial<Parameters<ChatRepo['createMessage']>[0]> & { body: string }) =>
    repo.createMessage({ channelId: chatChannel, threadId: null, authorId: u1, createdAt: at(0), ...over });

  describe('messages', () => {
    it('returns the latest N oldest first, and finds/deletes by id', async () => {
      const ch = (await fx.admin.from('channels').insert({ community_id: communityId, access_group_id: groupId, title: 'order', kind: 'chat' }).select('id').single()).data!.id;
      for (let i = 0; i < 4; i++) await msg({ channelId: ch, body: `m${i}`, createdAt: at(10 + i) });
      const got = await repo.messages({ channelId: ch }, 3);
      expect(got.map((m) => m.body)).toEqual(['m1', 'm2', 'm3']);
      expect(got[0]!.createdAt).toEqual(at(11));
      expect(got[0]!.threadId).toBeNull();
      expect((await repo.message(got[0]!.id))?.body).toBe('m1');
      await repo.deleteMessage(got[0]!.id);
      expect(await repo.message(got[0]!.id)).toBeNull();
      await repo.deleteMessage(got[0]!.id); // idempotent
    });

    it('enforces body length and the one-target rule', async () => {
      await expect(msg({ body: '   ' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(msg({ body: 'x'.repeat(4001) })).rejects.toBeInstanceOf(ConstraintError);
      expect((await msg({ body: 'x'.repeat(4000) })).body).toHaveLength(4000);
      await expect(msg({ channelId: null, threadId: null, body: 'a' })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('refuses messages in a feed channel', async () => {
      await expect(msg({ channelId: feedChannel, body: 'a' })).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  describe('dm threads', () => {
    it('stores the pair ordered, finds it either way, lists per participant', async () => {
      const t = await repo.createDmThread(communityId, u2, u1);
      expect(t.aId < t.bId).toBe(true);
      expect([t.aId, t.bId].toSorted()).toEqual([u1, u2].toSorted());
      expect((await repo.dmThreadBetween(communityId, u1, u2))?.id).toBe(t.id);
      expect((await repo.dmThreadBetween(communityId, u2, u1))?.id).toBe(t.id);
      expect(await repo.dmThreadBetween(communityId, u1, u3)).toBeNull();
      expect((await repo.dmThread(t.id))?.id).toBe(t.id);
      expect(await repo.dmThread('00000000-0000-0000-0000-000000000000')).toBeNull();
      expect((await repo.dmThreads(communityId, u1)).map((x) => x.id)).toContain(t.id);
      expect((await repo.dmThreads(communityId, u3)).map((x) => x.id)).not.toContain(t.id);
    });

    it('refuses self and duplicate threads', async () => {
      await expect(repo.createDmThread(communityId, u3, u3)).rejects.toBeInstanceOf(ConstraintError);
      await repo.createDmThread(communityId, u1, u3);
      await expect(repo.createDmThread(communityId, u3, u1)).rejects.toBeInstanceOf(ConstraintError);
    });

    it('carries DM messages', async () => {
      const t = (await repo.dmThreadBetween(communityId, u1, u3))!;
      await msg({ channelId: null, threadId: t.id, body: 'hi', createdAt: at(1) });
      await msg({ channelId: null, threadId: t.id, body: 'yo', authorId: u3, createdAt: at(2) });
      expect((await repo.messages({ threadId: t.id }, 10)).map((m) => m.body)).toEqual(['hi', 'yo']);
    });

    it('upserts reads per thread and profile', async () => {
      const t = (await repo.dmThreadBetween(communityId, u1, u3))!;
      expect(await repo.dmReads(u1, [])).toEqual([]);
      expect(await repo.dmReads(u1, [t.id])).toEqual([]);
      await repo.markDmRead(t.id, u1, at(5));
      await repo.markDmRead(t.id, u1, at(9));
      await repo.markDmRead(t.id, u3, at(7));
      expect(await repo.dmReads(u1, [t.id])).toEqual([{ threadId: t.id, profileId: u1, readAt: at(9) }]);
    });
  });

  describe('blocks', () => {
    it('sets idempotently, lists both directions, unsets', async () => {
      const row = { communityId, blockerId: u1, blockedId: u2 };
      await repo.setBlock(row, true);
      await repo.setBlock(row, true);
      expect(await repo.blocks(communityId, u1)).toEqual([row]);
      expect(await repo.blocks(communityId, u2)).toEqual([row]);
      expect(await repo.blocks(communityId, u3)).toEqual([]);
      await repo.setBlock(row, false);
      await repo.setBlock(row, false);
      expect(await repo.blocks(communityId, u1)).toEqual([]);
    });

    it('refuses blocking yourself', async () => {
      await expect(repo.setBlock({ communityId, blockerId: u1, blockedId: u1 }, true)).rejects.toBeInstanceOf(ConstraintError);
    });
  });
});
