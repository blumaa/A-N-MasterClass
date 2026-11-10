// Dev login switcher data (DATA_SOURCE=fake). Lists who can sign in on this space.
// REPLACED BY: Supabase Auth sign-in once the DB exists.
import type { Repo } from '@/lib/data/repo';
import type { Role, Space } from '@/lib/data/types';

export type DevProfile = { id: string; email: string; displayName: string; role: Role | null };

export async function devProfiles(repo: Repo, space: Space): Promise<DevProfile[]> {
  const [profiles, names] = await Promise.all([repo.profilesInSpace(space.id), repo.spaceProfiles(space.id)]);
  const members = await Promise.all(profiles.map((p) => repo.member(space.id, p.id)));
  return profiles.map((p, i) => ({
    id: p.id,
    email: p.email,
    displayName: names.find((n) => n.profileId === p.id)?.displayName ?? p.email,
    role: members[i]?.role ?? null,
  }));
}

/** Sign-in target must belong to this space: a client could post any profile id. */
export async function canSignInAs(repo: Repo, space: Space, profileId: string): Promise<boolean> {
  return (await repo.profilesInSpace(space.id)).some((p) => p.id === profileId);
}
