import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { DEFAULT_COMMUNITY_SETTINGS, type CommunitySettings, type PointsEntry, type Product } from '@/lib/data/types';
import { communityAccess } from './access';
import { leaderboard, periodStart } from './points';

const NOW = new Date('2026-11-11T12:00:00Z'); // Wednesday
let repo: FakeRepo;
let community: Product;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  community = (await repo.product(SEED_IDS.community))!;
});

const earn = (profileId: string, points: number, createdAt: Date, sourceKey = `${profileId}-${createdAt.getTime()}`): void => {
  const row: PointsEntry = { communityId: SEED_IDS.community, profileId, reason: 'comment', sourceKey, points, createdAt };
  repo.db.pointsLedger.push(row);
};
const settings = (patch: Partial<CommunitySettings>) =>
  repo.saveCommunitySettings({ communityId: SEED_IDS.community, ...DEFAULT_COMMUNITY_SETTINGS, ...patch });
const board = async (who: string, period: 'week' | 'month' | 'all' = 'all') => {
  const viewer = (await resolveViewer(repo, 'alexander', who))!;
  const access = await communityAccess(repo, viewer, community, NOW);
  return leaderboard(repo, viewer, community, access, period, NOW);
};

describe('periodStart (Kajabi: weekly resets Monday 08:00 UTC, monthly the 1st 08:00 UTC)', () => {
  it('finds the last reset', () => {
    expect(periodStart('week', NOW)).toEqual(new Date('2026-11-09T08:00:00Z'));
    expect(periodStart('week', new Date('2026-11-09T07:59:00Z'))).toEqual(new Date('2026-11-02T08:00:00Z'));
    expect(periodStart('week', new Date('2026-11-09T08:00:00Z'))).toEqual(new Date('2026-11-09T08:00:00Z'));
    expect(periodStart('month', NOW)).toEqual(new Date('2026-11-01T08:00:00Z'));
    expect(periodStart('month', new Date('2026-01-01T07:00:00Z'))).toEqual(new Date('2025-12-01T08:00:00Z'));
    expect(periodStart('all', NOW)).toBeNull();
  });
});

describe('leaderboard', () => {
  it('ranks by points with shared ranks on ties, names from the space, and the viewer row', async () => {
    earn(SEED_IDS.student, 10, NOW);
    earn(SEED_IDS.assistant, 10, NOW);
    earn(SEED_IDS.alexanderOwner, 30, NOW);
    expect(await board(SEED_IDS.student)).toEqual({
      period: 'all',
      rows: [
        { rank: 1, author: { id: SEED_IDS.alexanderOwner, name: 'Alexander' }, points: 30 },
        { rank: 2, author: { id: SEED_IDS.assistant, name: 'Sam (assistant)' }, points: 10 },
        { rank: 2, author: { id: SEED_IDS.student, name: 'Robin (student)' }, points: 10 },
      ],
      mine: { rank: 2, points: 10 },
    });
  });

  it('counts only points since the period start; viewer without points has no rank', async () => {
    earn(SEED_IDS.student, 5, new Date('2026-11-08T12:00:00Z'));
    earn(SEED_IDS.assistant, 7, NOW);
    const week = await board(SEED_IDS.student, 'week');
    expect(week?.rows.map((r) => r.author.id)).toEqual([SEED_IDS.assistant]);
    expect(week?.mine).toEqual({ rank: null, points: 0 });
    expect((await board(SEED_IDS.student, 'month'))?.rows).toHaveLength(2);
  });

  it('is hidden when points are off, the board is off, or the member group lacks it', async () => {
    await repo.updateAccessGroup(SEED_IDS.members, { leaderboard: false });
    expect(await board(SEED_IDS.student)).toBeNull();
    expect(await board(SEED_IDS.alexanderOwner)).not.toBeNull();
    await repo.updateAccessGroup(SEED_IDS.members, { leaderboard: true });
    await settings({ leaderboard: 'staff' });
    expect(await board(SEED_IDS.student)).toBeNull();
    expect(await board(SEED_IDS.alexanderOwner)).not.toBeNull();
    await settings({ leaderboard: 'off' });
    expect(await board(SEED_IDS.alexanderOwner)).toBeNull();
    await settings({ pointsEnabled: false });
    expect(await board(SEED_IDS.alexanderOwner)).toBeNull();
  });

  it('is hidden from viewers who cannot read the community', async () => {
    expect(await board(SEED_IDS.assistant)).toBeNull();
  });
});
