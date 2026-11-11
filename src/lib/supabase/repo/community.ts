// Supabase Repo: community (access groups, channels, settings, staff, posts, comments, reactions,
// notifications). Semantics mirror fakeCommunityRepo.ts / fakeChatRepo.ts; constraints come from SQL.
// Points are written by SQL triggers (comments_points, reactions_points), never here.
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import { DEFAULT_COMMUNITY_SETTINGS } from '@/lib/data/types';
import type { Json } from '@/lib/db/database.types';
import { check, defined, isoOrNull, nextPosition, unwrap, unwrapMaybe, type RepoCtx } from './context';
import {
  toAccessGroup,
  toChannel,
  toComment,
  toCommunitySettings,
  toNotification,
  toPost,
  toReaction,
} from './mapCommunity';

export type CommunityRepo = Pick<
  Repo,
  | 'accessGroups'
  | 'accessGroup'
  | 'createAccessGroup'
  | 'updateAccessGroup'
  | 'deleteAccessGroup'
  | 'channels'
  | 'channel'
  | 'createChannel'
  | 'updateChannel'
  | 'deleteChannel'
  | 'channelMembers'
  | 'setChannelMember'
  | 'communitySettings'
  | 'saveCommunitySettings'
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


export function createCommunityRepo({ db }: RepoCtx): CommunityRepo {
  return {
    // access groups: default first, then by title
    async accessGroups(communityId) {
      return unwrap(
        await (await db())
          .from('access_groups')
          .select('*')
          .eq('community_id', communityId)
          .order('is_default', { ascending: false })
          .order('title'),
      ).map(toAccessGroup);
    },
    async accessGroup(id) {
      const row = unwrapMaybe(await (await db()).from('access_groups').select('*').eq('id', id).maybeSingle());
      return row && toAccessGroup(row);
    },
    async createAccessGroup(input) {
      return toAccessGroup(
        unwrap(
          await (await db())
            .from('access_groups')
            .insert({ community_id: input.communityId, title: input.title, is_default: input.isDefault ?? false })
            .select('*')
            .single(),
        ),
      );
    },
    async updateAccessGroup(id, patch) {
      const client = await db();
      const values = defined(patch);
      const query =
        Object.keys(values).length === 0
          ? client.from('access_groups').select('*').eq('id', id)
          : client.from('access_groups').update(values).eq('id', id).select('*');
      return toAccessGroup(unwrap(await query.single()));
    },
    // Default group: trigger (23514). Group in use: FK restrict from channels/grants/offers/... (23503).
    async deleteAccessGroup(id) {
      check(await (await db()).from('access_groups').delete().eq('id', id));
    },

    // channels
    async channels(communityId) {
      return unwrap(
        await (await db()).from('channels').select('*').eq('community_id', communityId).order('position'),
      ).map(toChannel);
    },
    async channel(id) {
      const row = unwrapMaybe(await (await db()).from('channels').select('*').eq('id', id).maybeSingle());
      return row && toChannel(row);
    },
    // Community kind and group-in-community are enforced by triggers.
    async createChannel(input) {
      const client = await db();
      const position = await nextPosition(client, 'channels', 'community_id', input.communityId);
      return toChannel(
        unwrap(
          await client
            .from('channels')
            .insert({
              community_id: input.communityId,
              access_group_id: input.accessGroupId,
              title: input.title,
              kind: input.kind,
              privacy: input.privacy,
              read_only: input.readOnly,
              position,
            })
            .select('*')
            .single(),
        ),
      );
    },
    async updateChannel(id, patch) {
      const client = await db();
      const values = defined({ title: patch.title, privacy: patch.privacy, read_only: patch.readOnly });
      const query =
        Object.keys(values).length === 0
          ? client.from('channels').select('*').eq('id', id)
          : client.from('channels').update(values).eq('id', id).select('*');
      return toChannel(unwrap(await query.single()));
    },
    // Posts, messages and members cascade by FK / triggers.
    async deleteChannel(id) {
      check(await (await db()).from('channels').delete().eq('id', id));
    },
    async channelMembers(channelId) {
      return unwrap(await (await db()).from('channel_members').select('profile_id').eq('channel_id', channelId)).map(
        (r) => r.profile_id,
      );
    },
    async setChannelMember(channelId, profileId, on) {
      const client = await db();
      if (on) {
        check(
          await client
            .from('channel_members')
            .upsert(
              { channel_id: channelId, profile_id: profileId },
              { onConflict: 'channel_id,profile_id', ignoreDuplicates: true },
            ),
        );
        return;
      }
      check(await client.from('channel_members').delete().eq('channel_id', channelId).eq('profile_id', profileId));
    },

    // settings: no row = defaults
    async communitySettings(communityId) {
      const row = unwrapMaybe(
        await (await db()).from('community_settings').select('*').eq('community_id', communityId).maybeSingle(),
      );
      return row ? toCommunitySettings(row) : { communityId, ...DEFAULT_COMMUNITY_SETTINGS, pointValues: {} };
    },
    async saveCommunitySettings(row) {
      check(
        await (await db()).from('community_settings').upsert(
          {
            community_id: row.communityId,
            dms_enabled: row.dmsEnabled,
            founder_dms: row.founderDms,
            points_enabled: row.pointsEnabled,
            leaderboard: row.leaderboard,
            point_values: row.pointValues as Json,
          },
          { onConflict: 'community_id' },
        ),
      );
    },

    // staff ticks (space_member_communities)
    async communityStaff(communityId) {
      return unwrap(
        await (await db()).from('space_member_communities').select('profile_id').eq('community_id', communityId),
      ).map((r) => r.profile_id);
    },
    async setCommunityStaff(communityId, profileId, on) {
      const client = await db();
      if (!on) {
        check(
          await client
            .from('space_member_communities')
            .delete()
            .eq('community_id', communityId)
            .eq('profile_id', profileId),
        );
        return;
      }
      // SQL has no staff check on this table, so enforce it here like the fake does.
      const community = unwrap(await client.from('products').select('space_id').eq('id', communityId).single());
      const member = unwrapMaybe(
        await client
          .from('space_members')
          .select('profile_id')
          .eq('space_id', community.space_id)
          .eq('profile_id', profileId)
          .maybeSingle(),
      );
      if (!member) throw new ConstraintError('not staff of this space');
      check(
        await client
          .from('space_member_communities')
          .upsert(
            { community_id: communityId, profile_id: profileId },
            { onConflict: 'community_id,profile_id', ignoreDuplicates: true },
          ),
      );
    },

    // posts: pinned first, then newest first
    async posts(channelId) {
      return unwrap(
        await (await db())
          .from('posts')
          .select('*')
          .eq('channel_id', channelId)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false }),
      ).map(toPost);
    },
    async post(id) {
      const row = unwrapMaybe(await (await db()).from('posts').select('*').eq('id', id).maybeSingle());
      return row && toPost(row);
    },
    async createPost(input) {
      return toPost(
        unwrap(
          await (await db())
            .from('posts')
            .insert({
              channel_id: input.channelId,
              author_id: input.authorId,
              body: input.body,
              created_at: input.createdAt.toISOString(),
            })
            .select('*')
            .single(),
        ),
      );
    },
    async updatePost(id, patch) {
      const client = await db();
      const values = defined({ pinned: patch.pinned, hidden_at: isoOrNull(patch.hiddenAt) });
      const query =
        Object.keys(values).length === 0
          ? client.from('posts').select('*').eq('id', id)
          : client.from('posts').update(values).eq('id', id).select('*');
      return toPost(unwrap(await query.single()));
    },
    // Comments, reactions (triggers) and notifications (FK) go with it.
    async deletePost(id) {
      check(await (await db()).from('posts').delete().eq('id', id));
    },

    // comments: oldest first
    async comments(targetType, targetIds) {
      if (targetIds.length === 0) return [];
      return unwrap(
        await (await db())
          .from('comments')
          .select('*')
          .eq('target_type', targetType)
          .in('target_id', [...targetIds])
          .order('created_at'),
      ).map(toComment);
    },
    async comment(id) {
      const row = unwrapMaybe(await (await db()).from('comments').select('*').eq('id', id).maybeSingle());
      return row && toComment(row);
    },
    // Reply shape (top-level parent, same target) is enforced by trigger comments_parent_shape.
    async createComment(input) {
      return toComment(
        unwrap(
          await (await db())
            .from('comments')
            .insert({
              space_id: input.spaceId,
              target_type: input.targetType,
              target_id: input.targetId,
              parent_id: input.parentId,
              author_id: input.authorId,
              body: input.body,
              created_at: input.createdAt.toISOString(),
            })
            .select('*')
            .single(),
        ),
      );
    },
    async updateComment(id, patch) {
      const client = await db();
      const values = defined({ hidden_at: isoOrNull(patch.hiddenAt) });
      const query =
        Object.keys(values).length === 0
          ? client.from('comments').select('*').eq('id', id)
          : client.from('comments').update(values).eq('id', id).select('*');
      return toComment(unwrap(await query.single()));
    },
    // Replies (FK) and reactions (trigger comments_cleanup) go with it.
    async deleteComment(id) {
      check(await (await db()).from('comments').delete().eq('id', id));
    },

    // reactions
    async reactions(targetType, targetIds) {
      if (targetIds.length === 0) return [];
      return unwrap(
        await (await db())
          .from('reactions')
          .select('*')
          .eq('target_type', targetType)
          .in('target_id', [...targetIds])
          .order('created_at'),
      ).map(toReaction);
    },
    async setReaction(row, on) {
      const client = await db();
      if (on) {
        check(
          await client.from('reactions').upsert(
            {
              target_type: row.targetType,
              target_id: row.targetId,
              profile_id: row.profileId,
              emoji: row.emoji,
              created_at: row.createdAt.toISOString(),
            },
            { onConflict: 'target_type,target_id,profile_id,emoji', ignoreDuplicates: true },
          ),
        );
        return;
      }
      check(
        await client
          .from('reactions')
          .delete()
          .eq('target_type', row.targetType)
          .eq('target_id', row.targetId)
          .eq('profile_id', row.profileId)
          .eq('emoji', row.emoji),
      );
    },

    // notifications: newest first
    async notifications(spaceId, recipientId, limit) {
      return unwrap(
        await (await db())
          .from('notifications')
          .select('*')
          .eq('space_id', spaceId)
          .eq('recipient_id', recipientId)
          .order('created_at', { ascending: false })
          .limit(limit),
      ).map(toNotification);
    },
    async unreadNotificationCount(spaceId, recipientId) {
      const { count, error } = await (await db())
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .eq('recipient_id', recipientId)
        .is('read_at', null);
      check({ error });
      return count ?? 0;
    },
    // Runs as the caller: the insert policy lets a member notify others as themselves (actor = auth.uid()).
    async addNotifications(rows) {
      if (rows.length === 0) return;
      check(
        await (await db()).from('notifications').insert(
          rows.map((r) => ({
            space_id: r.spaceId,
            recipient_id: r.recipientId,
            actor_id: r.actorId,
            type: r.type,
            post_id: r.postId,
            step_id: r.stepId,
            created_at: r.createdAt.toISOString(),
          })),
        ),
      );
    },
    async markNotificationsRead(spaceId, recipientId, now) {
      check(
        await (await db())
          .from('notifications')
          .update({ read_at: now.toISOString() })
          .eq('space_id', spaceId)
          .eq('recipient_id', recipientId)
          .is('read_at', null),
      );
    },
  };
}
