import type { Repo } from './repo';

/** Display names of a space, by profile id. */
export async function spaceNames(repo: Repo, spaceId: string): Promise<ReadonlyMap<string, string>> {
  return new Map((await repo.spaceProfiles(spaceId)).map((sp) => [sp.profileId, sp.displayName]));
}
