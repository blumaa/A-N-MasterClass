// Supabase Repo: member data export and per-space erase (G25). Semantics mirror
// src/lib/data/fake/fakeMemberData.ts; rules live in 20261113000000_member_data.sql.
// Service role only: the DAL checks the viewer and passes its own profile id.
import type { ErasedMember, MemberSpaceData, Repo } from '@/lib/data/repo';
import { unwrap, type RepoCtx } from './context';

export type MemberDataRepo = Pick<Repo, 'memberSpaceData' | 'eraseMemberSpace' | 'deleteAccount'>;

type Erased = { site: string[]; community: string[]; last_space: boolean };

export function createMemberDataRepo({ admin }: RepoCtx): MemberDataRepo {
  return {
    async memberSpaceData(spaceId, profileId) {
      const args = { target_space: spaceId, target_profile: profileId };
      return unwrap(await admin().rpc('member_space_data', args)) as MemberSpaceData;
    },
    async eraseMemberSpace(spaceId, profileId): Promise<ErasedMember> {
      const args = { target_space: spaceId, target_profile: profileId };
      const r = unwrap(await admin().rpc('erase_member_space', args)) as Erased;
      return { files: { site: r.site, community: r.community }, lastSpace: r.last_space };
    },
    async deleteAccount(profileId) {
      const { error } = await admin().auth.admin.deleteUser(profileId);
      if (error) throw error;
    },
  };
}
