// Community shell for pages beside the channels (members, messages): readable channels and nav extras.
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { Channel, Product } from '@/lib/data/types';
import { readableChannels, type CommunityAccess } from './access';
import { communityNav, type CommunityNav } from './dms';
import { loadCommunity } from './feed';

export type CommunityShell = { community: Product; access: CommunityAccess; channels: Channel[]; nav: CommunityNav };

/** Null when the community is missing or the viewer cannot read it. */
export async function communityShell(repo: Repo, viewer: Viewer, slug: string, now: Date): Promise<CommunityShell | null> {
  const found = await loadCommunity(repo, viewer, slug, now);
  if (!found?.access.read || !viewer.profile) return null;
  const { community, access } = found;
  const [channels, nav] = await Promise.all([
    repo.channels(community.id).then((all) => readableChannels(repo, access, all, viewer.profile!.id)),
    communityNav(repo, viewer, community, access.directory, now),
  ]);
  return { community, access, channels, nav };
}
