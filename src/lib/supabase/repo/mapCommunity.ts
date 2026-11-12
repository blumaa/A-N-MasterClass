// Row (snake_case, ISO strings) -> domain type for the community tables.
import type {
  AccessGroup,
  Channel,
  Comment,
  CommunitySettings,
  Notification,
  Post,
  PostStatus,
  Reaction,
} from '@/lib/data/types';
import { toDate, toDateOrNull, type Row } from './context';

export const toAccessGroup = (r: Row<'access_groups'>): AccessGroup => ({
  id: r.id,
  communityId: r.community_id,
  title: r.title,
  isDefault: r.is_default,
  directory: r.directory,
  dms: r.dms,
  challenges: r.challenges,
  meetups: r.meetups,
  leaderboard: r.leaderboard,
});

export const toChannel = (r: Row<'channels'>): Channel => ({
  id: r.id,
  communityId: r.community_id,
  accessGroupId: r.access_group_id,
  title: r.title,
  kind: r.kind as Channel['kind'],
  privacy: r.privacy as Channel['privacy'],
  readOnly: r.read_only,
  position: r.position,
});

// point_values is guarded by is_point_values() in SQL, so the cast trusts the DB.
export const toCommunitySettings = (r: Row<'community_settings'>): CommunitySettings => ({
  communityId: r.community_id,
  dmsEnabled: r.dms_enabled,
  founderDms: r.founder_dms,
  pointsEnabled: r.points_enabled,
  leaderboard: r.leaderboard as CommunitySettings['leaderboard'],
  pointValues: r.point_values as CommunitySettings['pointValues'],
});

export const toPost = (r: Row<'posts'>): Post => ({
  id: r.id,
  channelId: r.channel_id,
  authorId: r.author_id,
  body: r.body,
  pinned: r.pinned,
  createdAt: toDate(r.created_at),
  hiddenAt: toDateOrNull(r.hidden_at),
  lockedAt: toDateOrNull(r.locked_at),
  status: r.status as PostStatus,
});

export const toComment = (r: Row<'comments'>): Comment => ({
  id: r.id,
  spaceId: r.space_id,
  targetType: r.target_type as Comment['targetType'],
  targetId: r.target_id,
  parentId: r.parent_id,
  authorId: r.author_id,
  body: r.body,
  createdAt: toDate(r.created_at),
  hiddenAt: toDateOrNull(r.hidden_at),
});

export const toReaction = (r: Row<'reactions'>): Reaction => ({
  targetType: r.target_type as Reaction['targetType'],
  targetId: r.target_id,
  profileId: r.profile_id,
  emoji: r.emoji as Reaction['emoji'],
  createdAt: toDate(r.created_at),
});

export const toNotification = (r: Row<'notifications'>): Notification => ({
  id: r.id,
  spaceId: r.space_id,
  recipientId: r.recipient_id,
  actorId: r.actor_id,
  type: r.type as Notification['type'],
  postId: r.post_id,
  stepId: r.step_id,
  communityId: r.community_id,
  createdAt: toDate(r.created_at),
  readAt: toDateOrNull(r.read_at),
});
