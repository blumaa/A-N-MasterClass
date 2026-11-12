// Side-nav extras of a community: Messages (with unread count) while DMs are on, then the
// links switched on by the viewer's access groups: Members, Challenges, Meetups, Leaderboard.
// Reports for anyone who moderates a channel.
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { Product } from '@/lib/data/types';
import { moderatedChannels, type CommunityAccess } from './access';
import { dmContext } from './chat';
import { unreadDms } from './dms';
import { seesLeaderboard } from './points';

export type CommunityNav = {
  directory: boolean;
  dms: { unread: number } | null;
  challenges: boolean;
  meetups: boolean;
  leaderboard: boolean;
  reports: boolean;
};

export async function communityNav(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  now: Date,
): Promise<CommunityNav> {
  const [dm, settings, channels] = await Promise.all([
    dmContext(repo, viewer, community, now),
    repo.communitySettings(community.id),
    repo.channels(community.id),
  ]);
  const me = viewer.profile?.id;
  const moderates = me ? (await moderatedChannels(repo, access, channels, me)).length > 0 : false;
  return {
    directory: access.directory,
    dms: dm?.enabled ? { unread: await unreadDms(repo, viewer, community, now) } : null,
    challenges: access.challenges,
    meetups: access.meetups,
    leaderboard: seesLeaderboard(settings, access),
    reports: moderates,
  };
}
