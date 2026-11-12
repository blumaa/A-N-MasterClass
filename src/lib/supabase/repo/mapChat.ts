// Row -> domain type for chat tables.
import type { Block, DmRead, DmThread, Message } from '@/lib/data/types';
import { toDate, type Row } from './context';

export const toMessage = (r: Row<'messages'>): Message => ({
  id: r.id,
  channelId: r.channel_id,
  threadId: r.thread_id,
  authorId: r.author_id,
  body: r.body,
  attachment:
    r.attachment_path === null
      ? null
      : { path: r.attachment_path, name: r.attachment_name ?? '', type: r.attachment_type ?? '', size: r.attachment_size ?? 0 },
  createdAt: toDate(r.created_at),
});

export const toDmThread = (r: Row<'dm_threads'>): DmThread => ({
  id: r.id,
  communityId: r.community_id,
  aId: r.a_id,
  bId: r.b_id,
});

export const toDmRead = (r: Row<'dm_reads'>): DmRead => ({
  threadId: r.thread_id,
  profileId: r.profile_id,
  readAt: toDate(r.read_at),
});

export const toBlock = (r: Row<'blocks'>): Block => ({
  communityId: r.community_id,
  blockerId: r.blocker_id,
  blockedId: r.blocked_id,
});
