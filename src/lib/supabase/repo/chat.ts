// Supabase Repo: chat messages, DM threads + reads, blocks.
// Semantics mirror src/lib/data/fake/fakeChatRepo.ts; constraints come from the SQL schema.
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import { check, unwrap, unwrapMaybe, type RepoCtx } from './context';
import { toBlock, toDmRead, toDmThread, toMessage } from './mapChat';

export type ChatRepo = Pick<
  Repo,
  | 'messages'
  | 'message'
  | 'createMessage'
  | 'deleteMessage'
  | 'dmThreads'
  | 'dmThread'
  | 'dmThreadBetween'
  | 'createDmThread'
  | 'dmReads'
  | 'markDmRead'
  | 'blocks'
  | 'setBlock'
>;

// uuid text compares like uuid in Postgres (lowercase hex, fixed width), so a_id < b_id matches the check.
const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

// No admin(): every method runs as the caller; RLS decides.
export function createChatRepo({ db }: RepoCtx): ChatRepo {
  return {
    async messages(where, limit) {
      const q = (await db()).from('messages').select('*');
      const scoped = 'channelId' in where ? q.eq('channel_id', where.channelId) : q.eq('thread_id', where.threadId);
      // Latest `limit` rows, then flipped to oldest first.
      const rows = unwrap(await scoped.order('created_at', { ascending: false }).order('id').limit(limit));
      return rows.map(toMessage).reverse();
    },
    async message(id) {
      const row = unwrapMaybe(await (await db()).from('messages').select('*').eq('id', id).maybeSingle());
      return row && toMessage(row);
    },
    async createMessage(input) {
      const row = unwrap(
        await (await db())
          .from('messages')
          .insert({
            channel_id: input.channelId,
            thread_id: input.threadId,
            author_id: input.authorId,
            body: input.body,
            attachment_path: input.attachment?.path ?? null,
            attachment_name: input.attachment?.name ?? null,
            attachment_type: input.attachment?.type ?? null,
            attachment_size: input.attachment?.size ?? null,
            created_at: input.createdAt.toISOString(),
          })
          .select('*')
          .single(),
      );
      return toMessage(row);
    },
    async deleteMessage(id) {
      check(await (await db()).from('messages').delete().eq('id', id));
    },

    async dmThreads(communityId, profileId) {
      return unwrap(
        await (await db())
          .from('dm_threads')
          .select('*')
          .eq('community_id', communityId)
          .or(`a_id.eq.${profileId},b_id.eq.${profileId}`)
          .order('created_at')
          .order('id'),
      ).map(toDmThread);
    },
    async dmThread(id) {
      const row = unwrapMaybe(await (await db()).from('dm_threads').select('*').eq('id', id).maybeSingle());
      return row && toDmThread(row);
    },
    async dmThreadBetween(communityId, x, y) {
      const [a, b] = pair(x, y);
      const row = unwrapMaybe(
        await (await db())
          .from('dm_threads')
          .select('*')
          .eq('community_id', communityId)
          .eq('a_id', a)
          .eq('b_id', b)
          .maybeSingle(),
      );
      return row && toDmThread(row);
    },
    async createDmThread(communityId, x, y) {
      if (x === y) throw new ConstraintError('no thread with yourself');
      const [a, b] = pair(x, y);
      const row = unwrap(
        await (await db())
          .from('dm_threads')
          .insert({ community_id: communityId, a_id: a, b_id: b })
          .select('*')
          .single(),
      );
      return toDmThread(row);
    },
    async dmReads(profileId, threadIds) {
      if (threadIds.length === 0) return [];
      return unwrap(
        await (await db()).from('dm_reads').select('*').eq('profile_id', profileId).in('thread_id', [...threadIds]),
      ).map(toDmRead);
    },
    async markDmRead(threadId, profileId, now) {
      check(
        await (await db())
          .from('dm_reads')
          .upsert(
            { thread_id: threadId, profile_id: profileId, read_at: now.toISOString() },
            { onConflict: 'thread_id,profile_id' },
          ),
      );
    },

    async blocks(communityId, profileId) {
      return unwrap(
        await (await db())
          .from('blocks')
          .select('*')
          .eq('community_id', communityId)
          .or(`blocker_id.eq.${profileId},blocked_id.eq.${profileId}`),
      ).map(toBlock);
    },
    async setBlock(row, on) {
      const t = await db();
      if (on) {
        check(
          await t
            .from('blocks')
            .upsert(
              { community_id: row.communityId, blocker_id: row.blockerId, blocked_id: row.blockedId },
              { onConflict: 'community_id,blocker_id,blocked_id', ignoreDuplicates: true },
            ),
        );
        return;
      }
      check(
        await t
          .from('blocks')
          .delete()
          .eq('community_id', row.communityId)
          .eq('blocker_id', row.blockerId)
          .eq('blocked_id', row.blockedId),
      );
    },
  };
}
