import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { DEFAULT_COMMUNITY_SETTINGS, type Product } from '@/lib/data/types';
import { communityAccess } from './access';
import { chatCommand } from './chat';
import { communityNav } from './nav';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let community: Product;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  community = (await repo.product(SEED_IDS.community))!;
});

const nav = async (who: string) => {
  const viewer = (await resolveViewer(repo, 'alexander', who))!;
  return communityNav(repo, viewer, community, await communityAccess(repo, viewer, community, NOW), NOW);
};

describe('communityNav', () => {
  it('shows Messages with unread count while DMs are on, and the group features', async () => {
    const student = (await resolveViewer(repo, 'alexander', SEED_IDS.student))!;
    const r = await chatCommand(repo, student, { op: 'startDm', communityId: SEED_IDS.community, recipientId: SEED_IDS.alexanderOwner }, NOW);
    if (!r.ok || !r.id) throw new Error('no thread');
    await chatCommand(repo, student, { op: 'sendDm', threadId: r.id, body: 'hello' }, NOW);
    expect(await nav(SEED_IDS.alexanderOwner)).toEqual({
      directory: true,
      dms: { unread: 1 },
      challenges: true,
      meetups: true,
      leaderboard: true,
    });
    await repo.saveCommunitySettings({ communityId: SEED_IDS.community, ...DEFAULT_COMMUNITY_SETTINGS, dmsEnabled: false, leaderboard: 'off' });
    expect(await nav(SEED_IDS.alexanderOwner)).toMatchObject({ dms: null, leaderboard: false });
  });

  it('follows the member group toggles', async () => {
    await repo.updateAccessGroup(SEED_IDS.members, { directory: false, challenges: false, meetups: false, leaderboard: false });
    expect(await nav(SEED_IDS.student)).toMatchObject({ directory: false, challenges: false, meetups: false, leaderboard: false });
  });
});
