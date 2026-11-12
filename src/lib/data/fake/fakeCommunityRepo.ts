// Community part of the fake repo. Same constraints as supabase/migrations/*_community.sql:
// channels only on community products, non-blank titles, body length checks, one reply level
// on the same target, unique reactions, staff ticks only for staff of the community's space,
// channel group in the same community, cascades (channel > posts > comments > reactions,
// messages, private members; post > notifications).
import { bodyRangeMessage, COMMENT_MAX, POST_MAX } from '../limits';
import { ConstraintError } from '../errors';
import type { Repo } from '../repo';
import type { Channel, Comment, Notification, Post, Reaction } from '../types';
import type { Db } from './db';

type CommunityRepo = Pick<
  Repo,
  | 'channels'
  | 'channel'
  | 'createChannel'
  | 'updateChannel'
  | 'deleteChannel'
  | 'communityStaff'
  | 'setCommunityStaff'
  | 'posts'
  | 'post'
  | 'createPost'
  | 'updatePost'
  | 'deletePost'
  | 'comments'
  | 'comment'
  | 'createComment'
  | 'updateComment'
  | 'deleteComment'
  | 'reactions'
  | 'setReaction'
  | 'notifications'
  | 'unreadNotificationCount'
  | 'addNotifications'
  | 'markNotificationsRead'
>;


function checkBody(body: string, max: number): void {
  if (body.trim().length === 0 || body.length > max) throw new ConstraintError(bodyRangeMessage(max));
}

function checkTitle(title: string): void {
  if (title.trim().length === 0) throw new ConstraintError('title required');
}

const sameReaction = (a: Reaction, b: Reaction): boolean =>
  a.targetType === b.targetType && a.targetId === b.targetId && a.profileId === b.profileId && a.emoji === b.emoji;

export function createFakeCommunityRepo(db: Db, id: (prefix: string) => string): CommunityRepo {
  function must<T>(row: T | undefined, what: string): T {
    if (!row) throw new Error(`${what} not found`);
    return row;
  }

  function removeComments(ids: Set<string>): void {
    const withReplies = new Set([...ids, ...db.comments.filter((c) => c.parentId && ids.has(c.parentId)).map((c) => c.id)]);
    db.reactions = db.reactions.filter((r) => !(r.targetType === 'comment' && withReplies.has(r.targetId)));
    db.comments = db.comments.filter((c) => !withReplies.has(c.id));
  }

  function removePosts(ids: Set<string>): void {
    removeComments(new Set(db.comments.filter((c) => c.targetType === 'post' && ids.has(c.targetId)).map((c) => c.id)));
    db.reactions = db.reactions.filter((r) => !(r.targetType === 'post' && ids.has(r.targetId)));
    db.notifications = db.notifications.filter((n) => !(n.postId && ids.has(n.postId)));
    db.posts = db.posts.filter((p) => !ids.has(p.id));
  }

  return {
    channels: async (communityId) =>
      db.channels.filter((c) => c.communityId === communityId).toSorted((a, b) => a.position - b.position),
    channel: async (cid) => db.channels.find((c) => c.id === cid) ?? null,
    async createChannel(input) {
      const community = db.products.find((p) => p.id === input.communityId);
      if (!community || community.kind !== 'community') throw new ConstraintError('channel needs a community product');
      const group = db.accessGroups.find((g) => g.id === input.accessGroupId);
      if (!group || group.communityId !== input.communityId) throw new ConstraintError('channel group must belong to its community');
      checkTitle(input.title);
      const siblings = db.channels.filter((c) => c.communityId === input.communityId);
      const row: Channel = { ...input, id: id('chan'), position: siblings.reduce((m, c) => Math.max(m, c.position + 1), 0) };
      db.channels.push(row);
      return row;
    },
    async updateChannel(cid, patch) {
      if (patch.title !== undefined) checkTitle(patch.title);
      return Object.assign(must(db.channels.find((c) => c.id === cid), 'channel'), patch);
    },
    async deleteChannel(cid) {
      removePosts(new Set(db.posts.filter((p) => p.channelId === cid).map((p) => p.id)));
      db.messages = db.messages.filter((m) => m.channelId !== cid);
      db.channelMembers = db.channelMembers.filter((m) => m.channelId !== cid);
      db.channelModerators = db.channelModerators.filter((m) => m.channelId !== cid);
      db.reports = db.reports.filter((r) => r.channelId !== cid);
      for (const m of db.meetups) if (m.channelId === cid) m.channelId = null;
      db.channels = db.channels.filter((c) => c.id !== cid);
    },

    communityStaff: async (communityId) =>
      db.communityStaff.filter((s) => s.communityId === communityId).map((s) => s.profileId),
    async setCommunityStaff(communityId, profileId, on) {
      const community = must(db.products.find((p) => p.id === communityId), 'community');
      if (!db.members.some((m) => m.spaceId === community.spaceId && m.profileId === profileId)) {
        throw new ConstraintError('not staff of this space');
      }
      db.communityStaff = db.communityStaff.filter((s) => !(s.communityId === communityId && s.profileId === profileId));
      if (on) db.communityStaff.push({ communityId, profileId });
    },

    posts: async (channelId) =>
      db.posts
        .filter((p) => p.channelId === channelId)
        .toSorted((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.getTime() - a.createdAt.getTime()),
    post: async (pid) => db.posts.find((p) => p.id === pid) ?? null,
    async createPost(input) {
      must(db.channels.find((c) => c.id === input.channelId), 'channel');
      checkBody(input.body, POST_MAX);
      const row: Post = { ...input, id: id('post'), pinned: false, hiddenAt: null };
      db.posts.push(row);
      return row;
    },
    updatePost: async (pid, patch) => Object.assign(must(db.posts.find((p) => p.id === pid), 'post'), patch),
    async deletePost(pid) {
      removePosts(new Set([pid]));
    },

    async comments(targetType, targetIds) {
      const ids = new Set(targetIds);
      return db.comments
        .filter((c) => c.targetType === targetType && ids.has(c.targetId))
        .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    comment: async (cid) => db.comments.find((c) => c.id === cid) ?? null,
    async createComment(input) {
      checkBody(input.body, COMMENT_MAX);
      if (input.parentId !== null) {
        const parent = db.comments.find((c) => c.id === input.parentId);
        if (!parent || parent.parentId !== null || parent.targetType !== input.targetType || parent.targetId !== input.targetId) {
          throw new ConstraintError('parent must be a top-level comment on the same target');
        }
      }
      const row: Comment = { ...input, id: id('comment'), hiddenAt: null };
      db.comments.push(row);
      return row;
    },
    updateComment: async (cid, patch) => Object.assign(must(db.comments.find((c) => c.id === cid), 'comment'), patch),
    async deleteComment(cid) {
      removeComments(new Set([cid]));
    },

    async reactions(targetType, targetIds) {
      const ids = new Set(targetIds);
      return db.reactions.filter((r) => r.targetType === targetType && ids.has(r.targetId));
    },
    async setReaction(row, on) {
      const exists = db.reactions.some((r) => sameReaction(r, row));
      if (on && !exists) db.reactions.push({ ...row });
      if (!on) db.reactions = db.reactions.filter((r) => !sameReaction(r, row));
    },

    notifications: async (spaceId, recipientId, limit) =>
      db.notifications
        .filter((n) => n.spaceId === spaceId && n.recipientId === recipientId)
        .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit),
    unreadNotificationCount: async (spaceId, recipientId) =>
      db.notifications.filter((n) => n.spaceId === spaceId && n.recipientId === recipientId && n.readAt === null).length,
    async addNotifications(rows) {
      db.notifications.push(...rows.map((r): Notification => ({ ...r, id: id('notif'), readAt: null })));
    },
    async markNotificationsRead(spaceId, recipientId, now) {
      for (const n of db.notifications) {
        if (n.spaceId === spaceId && n.recipientId === recipientId && n.readAt === null) n.readAt = now;
      }
    },
  };
}
