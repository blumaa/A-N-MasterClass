// Who may read and moderate a community (G13, G15). Mirrored in SQL by can_read_community().
// Members = active grant holders of a published community. Owner/admin reach every community;
// assistant/support only the ones they are ticked for (space_member_communities).
import { ALWAYS_REACH } from '@/lib/auth/capabilities';
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { Channel, Product } from '@/lib/data/types';

export type CommunityAccess = {
  read: boolean;
  moderatePosts: boolean;
  moderateComments: boolean;
};

const NONE: CommunityAccess = {
  read: false,
  moderatePosts: false,
  moderateComments: false,
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
      read: true,
      moderatePosts: viewerCan(viewer, 'community.moderate'),
      moderateComments: viewerCan(viewer, 'comments.moderate'),
    };
  }
  if (community.status !== 'published') return NONE;
  const grant = await repo.activeGrant(community.id, viewer.profile.id, now);
  return grant ? { ...NONE, read: true } : NONE;
}

/** read_only channels: only moderators post; members still comment and react. */
export const canPostIn = (access: CommunityAccess, channel: Channel): boolean =>
  access.read && (channel.visibility === 'public' || access.moderatePosts);
