// Member data repo against the linked project (rules: 270-member-data.test.sql).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCoreRepo, type CoreRepo } from './core';
import { check } from './context';
import { createCommunityRepo, type CommunityRepo } from './community';
import { createMemberDataRepo, type MemberDataRepo } from './memberData';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

describe.skipIf(!contractEnabled)('member data repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let core: CoreRepo;
  let communityRepo: CommunityRepo;
  let repo: MemberDataRepo;
  let student: string;

  beforeAll(async () => {
    fx = await createContractSpace('memberdata');
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    core = createCoreRepo(ctx);
    communityRepo = createCommunityRepo(ctx);
    repo = createMemberDataRepo(ctx);
    student = await fx.newUser('student');
    await core.ensureSpaceProfile({ spaceId: fx.spaceId, profileId: student, displayName: 'Robin' });
    const prog = await core.createProduct({ spaceId: fx.spaceId, kind: 'program', slug: 'md', title: 'MD' });
    await core.createGrant({ productId: prog.id, profileId: student, source: 'manual' });
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  it('exports moderation log, approval list and push mutes of this space', async () => {
    const { admin, spaceId } = fx;
    const community = await core.createProduct({ spaceId, kind: 'community', slug: 'md-comm', title: 'MD Community' });
    const groupId = (await communityRepo.accessGroups(community.id))[0]!.id;
    const channel = await communityRepo.createChannel({
      communityId: community.id, accessGroupId: groupId, title: 'Talk', kind: 'feed', privacy: 'public', readOnly: false,
    });
    const post = await communityRepo.createPost({ channelId: channel.id, authorId: student, body: 'x', createdAt: new Date() });
    // The moderation_log_target trigger overwrites channel and community from the target.
    check(
      await admin.from('moderation_log').insert({
        actor_id: student, action: 'hide', target_type: 'post', target_id: post.id, channel_id: channel.id, community_id: community.id,
      }),
    );
    check(await admin.from('post_approval_members').insert({ community_id: community.id, profile_id: student }));
    check(await admin.from('push_mutes').insert({ space_id: spaceId, profile_id: student, type: 'reaction' }));

    const data = await repo.memberSpaceData(spaceId, student);
    expect(data.moderation_log).toMatchObject([{ action: 'hide', target_type: 'post', target_id: post.id }]);
    expect(data.post_approval_members).toEqual([{ community: 'MD Community' }]);
    expect(data.push_mutes).toEqual([{ type: 'reaction' }]);
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
