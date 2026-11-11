// Platform admin (G1): profiles.is_platform_admin. Pure over Repo; the session lookup lives in
// currentViewer.ts. RLS (is_platform_admin()) enforces the same flag in the database.
import type { Repo } from '@/lib/data/repo';
import type { Profile } from '@/lib/data/types';

export async function asPlatformAdmin(repo: Repo, profileId: string | null): Promise<Profile | null> {
  const profile = profileId ? await repo.profile(profileId) : null;
  return profile?.isPlatformAdmin ? profile : null;
}
