import { beforeEach, describe, expect, it } from 'vitest';
import type { Comment, ReactionEmoji } from '../types';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-10T12:00:00Z');
const POST = 'post-welcome'; // by alexanderOwner, in announcements
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const totals = (since: Date | null = null) => repo.pointTotals(SEED_IDS.community, since);
const comment = (extra: Partial<Comment> = {}) =>
  repo.createComment({
    spaceId: SEED_IDS.alexander,
    targetType: 'post',
    targetId: POST,
    parentId: null,
    authorId: SEED_IDS.student,
    body: 'Nice',
    createdAt: NOW,
    ...extra,
  });
const react = (profileId: string, on: boolean, emoji: ReactionEmoji = '👍') =>
  repo.setReaction({ targetType: 'post', targetId: POST, profileId, emoji, createdAt: NOW }, on);
const dm = async () => {
  const t = await repo.createDmThread(SEED_IDS.community, SEED_IDS.student, SEED_IDS.alexanderOwner);
  return repo.createMessage({ channelId: null, threadId: t.id, authorId: SEED_IDS.student, body: 'hi', createdAt: NOW });
};

describe('points ledger (Kajabi defaults)', () => {
  it('awards 3 per post comment and removes them with the comment', async () => {
    const c = await comment();
    expect(await totals()).toEqual([{ profileId: SEED_IDS.student, points: 3 }]);
    await repo.deleteComment(c.id);
    expect(await totals()).toEqual([]);
  });

  it('awards 1 to reactor and 1 to author once per post, not for own posts', async () => {
    await react(SEED_IDS.student, true);
    await react(SEED_IDS.student, true, '🔥');
    await react(SEED_IDS.alexanderOwner, true);
    expect(await totals()).toEqual([
      { profileId: SEED_IDS.alexanderOwner, points: 1 },
      { profileId: SEED_IDS.student, points: 1 },
    ]);
    await react(SEED_IDS.student, false);
    expect(await totals()).toHaveLength(2);
    await react(SEED_IDS.student, false, '🔥');
    expect(await totals()).toEqual([]);
  });

  it('awards 1 per DM, nothing for chat channel messages', async () => {
    const m = await dm();
    await repo.createMessage({ channelId: SEED_IDS.lounge, threadId: null, authorId: SEED_IDS.student, body: 'x', createdAt: NOW });
    expect(await totals()).toEqual([{ profileId: SEED_IDS.student, points: 1 }]);
    await repo.deleteMessage(m.id);
    expect(await totals()).toEqual([]);
  });

  it('awards 100 per challenge entry', async () => {
    const c = await repo.createChallenge({
      communityId: SEED_IDS.community,
      accessGroupId: SEED_IDS.members,
      title: 'C',
      description: '',
      prize: null,
      startsAt: new Date(NOW.getTime() - 1000),
      endsAt: new Date(NOW.getTime() + 1000),
      showBeforeStart: false,
      createdAt: NOW,
    });
    await repo.createChallengeEntry({ challengeId: c.id, profileId: SEED_IDS.student, body: 'done', createdAt: NOW });
    expect(await totals()).toEqual([{ profileId: SEED_IDS.student, points: 100 }]);
    await repo.deleteChallenge(c.id);
    expect(await totals()).toEqual([]);
  });

  it('removes points of a deleted post and its comments', async () => {
    await comment();
    await react(SEED_IDS.student, true);
    await repo.deletePost(POST);
    expect(await totals()).toEqual([]);
  });

  it('uses custom values fixed at earn time; 0 or points off earns nothing', async () => {
    await repo.saveCommunitySettings({
      communityId: SEED_IDS.community,
      dmsEnabled: true,
      founderDms: true,
      pointsEnabled: true,
      leaderboard: 'members',
      pointValues: { comment: 5, dm: 0 },
    });
    await comment();
    await dm();
    await repo.saveCommunitySettings({
      communityId: SEED_IDS.community,
      dmsEnabled: true,
      founderDms: true,
      pointsEnabled: false,
      leaderboard: 'members',
      pointValues: { comment: 50 },
    });
    await comment();
    expect(await totals()).toEqual([{ profileId: SEED_IDS.student, points: 5 }]);
  });

  it('ignores step comments and counts only rows since the period start', async () => {
    await comment({ targetType: 'step', targetId: 'step-x' });
    await comment({ createdAt: new Date('2026-11-01T00:00:00Z') });
    expect(await totals(new Date('2026-11-09T08:00:00Z'))).toEqual([]);
    expect(await totals()).toEqual([{ profileId: SEED_IDS.student, points: 3 }]);
  });
});
