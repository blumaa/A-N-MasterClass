// Who may read and moderate a community (G13, G15), and which of its channels.
// Mirrored in SQL by can_read_community() / can_read_channel() / can_moderate_channel().
// Members = active grant holders of a published community; each grant joins one access group
// (null = the default group). Owner/admin reach every community; assistant/support only the
// ones they are ticked for (space_member_communities). Staff read every channel.
import { ALWAYS_REACH } from '@/lib/auth/capabilities';
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import { ALL_GROUP_FEATURES, GROUP_FEATURES, type Channel, type GroupFeature, type Product } from '@/lib/data/types';

export type CommunityAccess = {
  read: boolean;
  /** Reaches the community as staff: every channel, every group. */
  staff: boolean;
  moderatePosts: boolean;
  moderateComments: boolean;
  /** Access groups the member holds (empty for staff). */
  groupIds: string[];
} & Record<GroupFeature, boolean>; // feature toggles: union over the member's groups; staff always

const NO_FEATURES = Object.fromEntries(GROUP_FEATURES.map((f) => [f, false])) as Record<GroupFeature, boolean>;

const NONE: CommunityAccess = {
  read: false,
  staff: false,
  moderatePosts: false,
  moderateComments: false,
  groupIds: [],
  ...NO_FEATURES,
};

export async function reachesAsStaff(repo: Repo, viewer: Viewer, communityId: string): Promise<boolean> {
  if (!viewer.role || !viewer.profile) return false;
  if (ALWAYS_REACH.includes(viewer.role)) return true;
  return (await repo.communityStaff(communityId)).includes(viewer.profile.id);
}

export async function communityAccess(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  now: Date,
): Promise<CommunityAccess> {
  if (!viewer.profile || community.kind !== 'community' || community.spaceId !== viewer.space.id) return NONE;
  if (await reachesAsStaff(repo, viewer, community.id)) {
    return {
      ...NONE,
      read: true,
      staff: true,
      moderatePosts: viewerCan(viewer, 'community.moderate'),
      moderateComments: viewerCan(viewer, 'comments.moderate'),
      ...ALL_GROUP_FEATURES,
    };
  }
  if (community.status !== 'published') return NONE;
  const [grants, groups] = await Promise.all([
    repo.grants(community.spaceId, viewer.profile.id, now),
    repo.accessGroups(community.id),
  ]);
  const defaultId = groups.find((g) => g.isDefault)?.id;
  const groupIds = [
    ...new Set(grants.filter((g) => g.productId === community.id).map((g) => g.accessGroupId ?? defaultId)),
  ].filter((id): id is string => id !== undefined);
  if (groupIds.length === 0) return NONE;
  const held = groups.filter((g) => groupIds.includes(g.id));
  return {
    ...NONE,
    read: true,
    groupIds,
    ...(Object.fromEntries(GROUP_FEATURES.map((f) => [f, held.some((g) => g[f])])) as Record<GroupFeature, boolean>),
  };
}

export type ChannelAccess = {
  read: boolean;
  post: boolean;
  /** Hide, delete, pin posts; delete chat lines. Staff with community.moderate, or a channel moderator. */
  moderatePosts: boolean;
  /** Hide and delete comments on posts. Staff with comments.moderate, or a channel moderator. */
  moderateComments: boolean;
};

const canRead = (access: CommunityAccess, channel: Channel, invited: boolean): boolean =>
  access.read &&
  (access.staff || (access.groupIds.includes(channel.accessGroupId) && (channel.privacy === 'public' || invited)));

/** invited = member of the (private) channel; moderator = picked for it (G15). Mirrors can_moderate_channel(). */
const channelRule = (access: CommunityAccess, channel: Channel, invited: boolean, moderator: boolean): ChannelAccess => {
  const read = canRead(access, channel, invited);
  const mod = read && moderator;
  return {
    read,
    // Read-only: only staff moderators post (feed) or send (chat); members still comment and react.
    post: read && (!channel.readOnly || access.moderatePosts),
    moderatePosts: read && (access.moderatePosts || mod),
    moderateComments: read && (access.moderateComments || mod),
  };
};

const needsInvite = (access: CommunityAccess, channel: Channel): boolean =>
  access.read && !access.staff && channel.privacy === 'private';

const isInvited = async (repo: Repo, access: CommunityAccess, channel: Channel, profileId: string) =>
  needsInvite(access, channel) && (await repo.channelMembers(channel.id)).includes(profileId);

export async function channelAccess(
  repo: Repo,
  access: CommunityAccess,
  channel: Channel,
  profileId: string,
): Promise<ChannelAccess> {
  const invited = await isInvited(repo, access, channel, profileId);
  const askModerator = canRead(access, channel, invited) && !(access.moderatePosts && access.moderateComments);
  const moderator = askModerator && (await repo.channelModerators(channel.id)).includes(profileId);
  return channelRule(access, channel, invited, moderator);
}

/** Channels the viewer reads, order kept. */
export async function readableChannels(
  repo: Repo,
  access: CommunityAccess,
  channels: readonly Channel[],
  profileId: string,
): Promise<Channel[]> {
  const read = await Promise.all(channels.map(async (c) => canRead(access, c, await isInvited(repo, access, c, profileId))));
  return channels.filter((_, i) => read[i]);
}

/** Channels the viewer moderates posts in (staff: all readable; channel moderators: theirs). */
export async function moderatedChannels(
  repo: Repo,
  access: CommunityAccess,
  channels: readonly Channel[],
  profileId: string,
): Promise<Channel[]> {
  const rules = await Promise.all(channels.map((c) => channelAccess(repo, access, c, profileId)));
  return channels.filter((_, i) => rules[i]!.moderatePosts);
}

export type ChannelScope = { channel: Channel; community: Product; access: CommunityAccess; rules: ChannelAccess };

/** A channel of the viewer's space, with the viewer's rules there. Null when missing or foreign. */
export async function channelScope(repo: Repo, viewer: Viewer, channelId: string, now: Date): Promise<ChannelScope | null> {
  const channel = await repo.channel(channelId);
  const community = channel ? await repo.product(channel.communityId) : null;
  if (!channel || !community || community.spaceId !== viewer.space.id || !viewer.profile) return null;
  const access = await communityAccess(repo, viewer, community, now);
  return { channel, community, access, rules: await channelAccess(repo, access, channel, viewer.profile.id) };
}

/** A group-scoped item (challenge, meetup) is for staff and the members of its group. */
export const reachesGroup = (access: CommunityAccess, groupId: string): boolean =>
  access.read && (access.staff || access.groupIds.includes(groupId));
