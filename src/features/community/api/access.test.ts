import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { Product } from '@/lib/data/types';
import { canPostIn, communityAccess } from './access';

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
      moderatePosts: false,
      moderateComments: false,
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
    expect(await communityAccess(repo, await as(SEED_IDS.alexanderOwner), draft, NOW)).toEqual({
      read: true,
      moderatePosts: true,
      moderateComments: true,
    });
  });

  it('assistant reaches a community only once ticked (G15)', async () => {
    expect((await communityAccess(repo, await as(SEED_IDS.assistant), community, NOW)).read).toBe(false);
    await repo.setCommunityStaff(community.id, SEED_IDS.assistant, true);
    expect(await communityAccess(repo, await as(SEED_IDS.assistant), community, NOW)).toEqual({
      read: true,
      moderatePosts: true,
      moderateComments: true,
    });
  });

  it('refuses products that are not communities', async () => {
    const program = (await repo.product(SEED_IDS.program))!;
    expect((await communityAccess(repo, await as(SEED_IDS.alexanderOwner), program, NOW)).read).toBe(false);
  });
});

describe('canPostIn', () => {
  it('members post in public channels only; moderators post anywhere', async () => {
    const general = (await repo.channel(SEED_IDS.general))!;
    const announcements = (await repo.channel(SEED_IDS.announcements))!;
    const member = { read: true, moderatePosts: false, moderateComments: false };
    const mod = { read: true, moderatePosts: true, moderateComments: true };
    expect(canPostIn(member, general)).toBe(true);
    expect(canPostIn(member, announcements)).toBe(false);
    expect(canPostIn(mod, announcements)).toBe(true);
    expect(canPostIn({ ...member, read: false }, general)).toBe(false);
  });
});
