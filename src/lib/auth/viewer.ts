// Who is looking at which space. Pure over Repo; session lookup lives in currentViewer.ts.
import type { Repo } from '@/lib/data/repo';
import type { Profile, Role, Space } from '@/lib/data/types';
import { can, type Capability } from './capabilities';

export type Viewer = {
  space: Space;
  profile: Profile | null;
  role: Role | null;
  displayName: string | null;
};

export async function resolveViewer(repo: Repo, spaceSlug: string, profileId: string | null): Promise<Viewer | null> {
  const space = await repo.spaceBySlug(spaceSlug);
  if (!space) return null;
  const profile = profileId ? await repo.profile(profileId) : null;
  if (!profile) return { space, profile: null, role: null, displayName: null };
  const [member, names] = await Promise.all([repo.member(space.id, profile.id), repo.spaceProfiles(space.id)]);
  return {
    space,
    profile,
    role: member?.role ?? null,
    displayName: names.find((n) => n.profileId === profile.id)?.displayName ?? profile.email,
  };
}

export const viewerCan = (viewer: Viewer, cap: Capability): boolean => viewer.role !== null && can(viewer.role, cap);

/** Site, library and studio of a draft or archived space: staff and platform admins only.
 * Login, claim and account pages stay open so a new owner can get in. */
export const canSeeSpace = (viewer: Viewer): boolean =>
  viewer.space.status === 'live' || viewer.role !== null || viewer.profile?.isPlatformAdmin === true;
