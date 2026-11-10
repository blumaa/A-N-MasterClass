// Chat part of the fake repo: access groups, private channel members, chat messages, DMs,
// blocks and community settings. Same constraints as
// supabase/migrations/*_community_groups_chat_dms.sql.
import { ConstraintError } from '../errors';
import type { Repo } from '../repo';
import { ALL_GROUP_FEATURES, DEFAULT_COMMUNITY_SETTINGS, type AccessGroup, type Block, type DmThread, type Message } from '../types';
import type { Db } from './db';

type ChatRepo = Pick<
  Repo,
  | 'accessGroups'
  | 'accessGroup'
  | 'createAccessGroup'
  | 'updateAccessGroup'
  | 'deleteAccessGroup'
  | 'channelMembers'
  | 'setChannelMember'
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
  | 'communitySettings'
  | 'saveCommunitySettings'
>;

export const MESSAGE_MAX = 4_000;
/** Title of the group every community product starts with. */
export const DEFAULT_GROUP_TITLE = 'Members';

const sameBlock = (a: Block, b: Block): boolean =>
  a.communityId === b.communityId && a.blockerId === b.blockerId && a.blockedId === b.blockedId;

export function createFakeChatRepo(db: Db, id: (prefix: string) => string): ChatRepo {
  function must<T>(row: T | undefined, what: string): T {
    if (!row) throw new Error(`${what} not found`);
    return row;
  }
  const checkTitle = (title: string): void => {
    if (title.trim().length === 0) throw new ConstraintError('title required');
  };
  const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);
  const between = (communityId: string, x: string, y: string): DmThread | undefined => {
    const [aId, bId] = pair(x, y);
    return db.dmThreads.find((t) => t.communityId === communityId && t.aId === aId && t.bId === bId);
  };

  return {
    accessGroups: async (communityId) =>
      db.accessGroups
        .filter((g) => g.communityId === communityId)
        .toSorted((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.title.localeCompare(b.title)),
    accessGroup: async (gid) => db.accessGroups.find((g) => g.id === gid) ?? null,
    async createAccessGroup(input) {
      const community = db.products.find((p) => p.id === input.communityId);
      if (!community || community.kind !== 'community') throw new ConstraintError('access group needs a community product');
      checkTitle(input.title);
      const isDefault = input.isDefault ?? false;
      if (isDefault && db.accessGroups.some((g) => g.communityId === input.communityId && g.isDefault)) {
        throw new ConstraintError('a community has one default group');
      }
      const row: AccessGroup = { ...input, id: id('group'), isDefault, ...ALL_GROUP_FEATURES };
      db.accessGroups.push(row);
      return row;
    },
    async updateAccessGroup(gid, patch) {
      if (patch.title !== undefined) checkTitle(patch.title);
      return Object.assign(must(db.accessGroups.find((g) => g.id === gid), 'access group'), patch);
    },
    async deleteAccessGroup(gid) {
      const group = must(db.accessGroups.find((g) => g.id === gid), 'access group');
      if (group.isDefault) throw new ConstraintError('the default group cannot be deleted');
      const used =
        db.channels.some((c) => c.accessGroupId === gid) ||
        db.grants.some((g) => g.accessGroupId === gid) ||
        db.offerProducts.some((o) => o.accessGroupId === gid) ||
        db.challenges.some((c) => c.accessGroupId === gid) ||
        db.meetups.some((m) => m.accessGroupId === gid);
      if (used) throw new ConstraintError('group in use');
      db.accessGroups = db.accessGroups.filter((g) => g.id !== gid);
    },

    channelMembers: async (channelId) => db.channelMembers.filter((m) => m.channelId === channelId).map((m) => m.profileId),
    async setChannelMember(channelId, profileId, on) {
      must(db.channels.find((c) => c.id === channelId), 'channel');
      db.channelMembers = db.channelMembers.filter((m) => !(m.channelId === channelId && m.profileId === profileId));
      if (on) db.channelMembers.push({ channelId, profileId });
    },

    async messages(where, limit) {
      const match = 'channelId' in where ? (m: Message) => m.channelId === where.channelId : (m: Message) => m.threadId === where.threadId;
      return db.messages
        .filter(match)
        .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-limit);
    },
    message: async (mid) => db.messages.find((m) => m.id === mid) ?? null,
    async createMessage(input) {
      if ((input.channelId === null) === (input.threadId === null)) {
        throw new ConstraintError('a message needs exactly one of channel or thread');
      }
      if (input.channelId !== null && must(db.channels.find((c) => c.id === input.channelId), 'channel').kind !== 'chat') {
        throw new ConstraintError('messages only in chat channels');
      }
      if (input.threadId !== null) must(db.dmThreads.find((t) => t.id === input.threadId), 'thread');
      if (input.body.trim().length === 0 || input.body.length > MESSAGE_MAX) {
        throw new ConstraintError(`body must be 1..${MESSAGE_MAX} chars`);
      }
      const row: Message = { ...input, id: id('msg') };
      db.messages.push(row);
      return row;
    },
    async deleteMessage(mid) {
      db.messages = db.messages.filter((m) => m.id !== mid);
    },

    dmThreads: async (communityId, profileId) =>
      db.dmThreads.filter((t) => t.communityId === communityId && (t.aId === profileId || t.bId === profileId)),
    dmThread: async (tid) => db.dmThreads.find((t) => t.id === tid) ?? null,
    dmThreadBetween: async (communityId, x, y) => between(communityId, x, y) ?? null,
    async createDmThread(communityId, x, y) {
      if (x === y) throw new ConstraintError('no thread with yourself');
      if (between(communityId, x, y)) throw new ConstraintError('thread exists');
      const [aId, bId] = pair(x, y);
      const row: DmThread = { id: id('dm'), communityId, aId, bId };
      db.dmThreads.push(row);
      return row;
    },
    async dmReads(profileId, threadIds) {
      const ids = new Set(threadIds);
      return db.dmReads.filter((r) => r.profileId === profileId && ids.has(r.threadId));
    },
    async markDmRead(threadId, profileId, now) {
      db.dmReads = [...db.dmReads.filter((r) => !(r.threadId === threadId && r.profileId === profileId)), { threadId, profileId, readAt: now }];
    },

    blocks: async (communityId, profileId) =>
      db.blocks.filter((b) => b.communityId === communityId && (b.blockerId === profileId || b.blockedId === profileId)),
    async setBlock(row, on) {
      db.blocks = db.blocks.filter((b) => !sameBlock(b, row));
      if (on) db.blocks.push({ ...row });
    },

    communitySettings: async (communityId) =>
      db.communitySettings.find((s) => s.communityId === communityId) ?? { communityId, ...DEFAULT_COMMUNITY_SETTINGS, pointValues: {} },
    async saveCommunitySettings(row) {
      const copy = { ...row, pointValues: { ...row.pointValues } };
      db.communitySettings = [...db.communitySettings.filter((s) => s.communityId !== row.communityId), copy];
    },
  };
}
