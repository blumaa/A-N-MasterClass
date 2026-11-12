// Member data repo against the linked project (rules: 270-member-data.test.sql).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCoreRepo, type CoreRepo } from './core';
import { createMemberDataRepo, type MemberDataRepo } from './memberData';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

describe.skipIf(!contractEnabled)('member data repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let core: CoreRepo;
  let repo: MemberDataRepo;
  let student: string;

  beforeAll(async () => {
    fx = await createContractSpace('memberdata');
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    core = createCoreRepo(ctx);
    repo = createMemberDataRepo(ctx);
    student = await fx.newUser('student');
    await core.ensureSpaceProfile({ spaceId: fx.spaceId, profileId: student, displayName: 'Robin' });
    const prog = await core.createProduct({ spaceId: fx.spaceId, kind: 'program', slug: 'md', title: 'MD' });
    await core.createGrant({ productId: prog.id, profileId: student, source: 'manual' });
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  it('exports, erases the last space, then deletes the account', async () => {
    const data = await repo.memberSpaceData(fx.spaceId, student);
    expect(data.account).toEqual({ email: fx.email('student') });
    expect(data.access).toHaveLength(1);
    expect(await repo.eraseMemberSpace(fx.spaceId, student)).toEqual({ lastSpace: true });
    expect(await core.spaceProfiles(fx.spaceId)).toEqual([]);
    await repo.deleteAccount(student);
    expect(await core.profile(student)).toBeNull();
  });
});
