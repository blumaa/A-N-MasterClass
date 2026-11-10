import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { Product } from '@/lib/data/types';
import { channelAccess, communityAccess, readableChannels, type CommunityAccess } from './access';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let community: Product;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  community = (await repo.product(SEED_IDS.community))!;
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

describe('communityAccess', () => {
  it('lets grant holders read a published community, without moderation', async () => {
    expect(await communityAccess(repo, await as(SEED_IDS.student), community, NOW)).toEqual({
      read: true,
      staff: false,
      moderatePosts: false,
      moderateComments: false,
      groupIds: [SEED_IDS.members],
      directory: true,
      dms: true,
    });
  });

  it('refuses members once the community is a draft, or the grant is revoked', async () => {
    await repo.updateProduct(community.id, { status: 'draft' });
    const draft = (await repo.product(community.id))!;
    expect((await communityAccess(repo, await as(SEED_IDS.student), draft, NOW)).read).toBe(false);
    await repo.updateProduct(community.id, { status: 'published' });
    await repo.revokeGrant('grant-student-community');
    expect((await communityAccess(repo, await as(SEED_IDS.student), community, NOW)).read).toBe(false);
  });

  it('refuses signed-out viewers and viewers of another space', async () => {
    expect((await communityAccess(repo, await as(null), community, NOW)).read).toBe(false);
    expect((await communityAccess(repo, await as(SEED_IDS.natashaOwner, 'natasha'), community, NOW)).read).toBe(false);
  });

  it('owner reaches every community, drafts too, with full moderation', async () => {
    await repo.updateProduct(community.id, { status: 'draft' });
    const draft = (await repo.product(community.id))!;
    expect(await communityAccess(repo, await as(SEED_IDS.alexanderOwner), draft, NOW)).toMatchObject({
      read: true,
      staff: true,
      moderatePosts: true,
      moderateComments: true,
      directory: true,
      dms: true,
    });
  });

  it('assistant reaches a community only once ticked (G15)', async () => {
    expect((await communityAccess(repo, await as(SEED_IDS.assistant), community, NOW)).read).toBe(false);
    await repo.setCommunityStaff(community.id, SEED_IDS.assistant, true);
    expect(await communityAccess(repo, await as(SEED_IDS.assistant), community, NOW)).toMatchObject({
      read: true,
      staff: true,
      moderatePosts: true,
      moderateComments: true,
    });
  });

  it('refuses products that are not communities', async () => {
    const program = (await repo.product(SEED_IDS.program))!;
    expect((await communityAccess(repo, await as(SEED_IDS.alexanderOwner), program, NOW)).read).toBe(false);
  });

  it('joins every group the member holds a grant for; features are the union of those groups', async () => {
    const vip = await repo.createAccessGroup({ communityId: community.id, title: 'VIP' });
    await repo.updateAccessGroup(vip.id, { directory: false, dms: false });
    await repo.updateAccessGroup(SEED_IDS.members, { directory: false });
    await repo.createGrant({ productId: community.id, profileId: SEED_IDS.student, source: 'manual', orderId: null, accessGroupId: vip.id });
    const access = await communityAccess(repo, await as(SEED_IDS.student), community, NOW);
    expect(access.groupIds.toSorted()).toEqual([SEED_IDS.members, vip.id].toSorted());
    expect(access.directory).toBe(false);
    expect(access.dms).toBe(true);
  });

  it('a member holding only an extra group is not in the default group', async () => {
    const vip = await repo.createAccessGroup({ communityId: community.id, title: 'VIP' });
    await repo.revokeGrant('grant-student-community');
    await repo.createGrant({ productId: community.id, profileId: SEED_IDS.student, source: 'manual', orderId: null, accessGroupId: vip.id });
    expect((await communityAccess(repo, await as(SEED_IDS.student), community, NOW)).groupIds).toEqual([vip.id]);
  });
});

const member: CommunityAccess = {
  read: true,
  staff: false,
  moderatePosts: false,
  moderateComments: false,
  groupIds: [SEED_IDS.members],
  directory: true,
  dms: true,
};
const owner: CommunityAccess = { ...member, staff: true, moderatePosts: true, moderateComments: true, groupIds: [] };

describe('channelAccess', () => {
  it('members read and post in public channels of their group', async () => {
    const general = (await repo.channel(SEED_IDS.general))!;
    expect(await channelAccess(repo, member, general, SEED_IDS.student)).toEqual({ read: true, post: true });
  });

  it('read-only channels: members read, only moderators post', async () => {
    const announcements = (await repo.channel(SEED_IDS.announcements))!;
    expect(await channelAccess(repo, member, announcements, SEED_IDS.student)).toEqual({ read: true, post: false });
    expect(await channelAccess(repo, owner, announcements, SEED_IDS.alexanderOwner)).toEqual({ read: true, post: true });
  });

  it('channels of another group are closed to members, open to staff', async () => {
    const vip = await repo.createAccessGroup({ communityId: community.id, title: 'VIP' });
    const backstage = await repo.createChannel({ communityId: community.id, accessGroupId: vip.id, title: 'Backstage', kind: 'feed', privacy: 'public', readOnly: false });
    expect(await channelAccess(repo, member, backstage, SEED_IDS.student)).toEqual({ read: false, post: false });
    expect(await channelAccess(repo, owner, backstage, SEED_IDS.alexanderOwner)).toEqual({ read: true, post: true });
  });

  it('private channels: only invited members of the group', async () => {
    const circle = await repo.createChannel({
      communityId: community.id,
      accessGroupId: SEED_IDS.members,
      title: 'Inner circle',
      kind: 'feed',
      privacy: 'private',
      readOnly: false,
    });
    expect((await channelAccess(repo, member, circle, SEED_IDS.student)).read).toBe(false);
    await repo.setChannelMember(circle.id, SEED_IDS.student, true);
    expect(await channelAccess(repo, member, circle, SEED_IDS.student)).toEqual({ read: true, post: true });
  });

  it('nothing without community read', async () => {
    const general = (await repo.channel(SEED_IDS.general))!;
    expect(await channelAccess(repo, { ...member, read: false }, general, SEED_IDS.student)).toEqual({ read: false, post: false });
  });
});

describe('readableChannels', () => {
  it('keeps the order and drops channels the viewer cannot read', async () => {
    const vip = await repo.createAccessGroup({ communityId: community.id, title: 'VIP' });
    await repo.createChannel({ communityId: community.id, accessGroupId: vip.id, title: 'Backstage', kind: 'feed', privacy: 'public', readOnly: false });
    const all = await repo.channels(community.id);
    expect((await readableChannels(repo, member, all, SEED_IDS.student)).map((c) => c.title)).toEqual([
      'General',
      'Announcements',
      'Lounge',
    ]);
    expect(await readableChannels(repo, owner, all, SEED_IDS.alexanderOwner)).toHaveLength(4);
  });
});
