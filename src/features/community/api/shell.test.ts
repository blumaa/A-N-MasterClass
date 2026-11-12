import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { liveTopic } from '@/lib/realtime/topics';
import { communityShell } from './shell';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const viewer = (who: string | null) => resolveViewer(repo, 'alexander', who).then((v) => v!);

describe('communityShell', () => {
  it('gives readers the community, readable channels and nav extras', async () => {
    await repo.createChannel({
      communityId: SEED_IDS.community,
      accessGroupId: SEED_IDS.members,
      title: 'Secret',
      kind: 'chat',
      privacy: 'private',
      readOnly: false,
    });
    const shell = await communityShell(repo, await viewer(SEED_IDS.student), 'community', NOW);
    expect(shell?.community.id).toBe(SEED_IDS.community);
    expect(shell?.channels.map((c) => c.title)).not.toContain('Secret');
    expect(shell?.nav).toEqual({
      directory: true,
      dms: { unread: 0 },
      challenges: true,
      meetups: true,
      leaderboard: true,
      reports: false,
      live: [liveTopic.community(SEED_IDS.community), liveTopic.inbox(SEED_IDS.student)],
    });
  });

  it('is null for visitors without access and unknown slugs', async () => {
    expect(await communityShell(repo, await viewer(null), 'community', NOW)).toBeNull();
    expect(await communityShell(repo, await viewer(SEED_IDS.student), 'nope', NOW)).toBeNull();
  });
});
