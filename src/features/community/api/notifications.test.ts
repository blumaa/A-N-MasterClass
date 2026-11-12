import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { communityCommand, type StepGate } from './commands';
import { describeNotifications, markAllRead, notificationFeed, stepThread, unreadCount } from './notifications';

const NOW = new Date('2026-11-10T12:00:00Z');
const open: StepGate = async () => true;
const shut: StepGate = async () => false;
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;

async function studentPostWithOwnerComment(): Promise<string> {
  const r = await communityCommand(repo, await as(SEED_IDS.student),
    { op: 'createPost', channelId: SEED_IDS.general, body: 'hello' },
    NOW,
    open,
  );
  if (!r.ok || !r.id) throw new Error('post failed');
  await communityCommand(repo, await as(SEED_IDS.alexanderOwner),
    { op: 'createComment', target: { type: 'post', id: r.id }, parentId: null, body: 'hi' },
    NOW,
    open,
  );
  return r.id;
}

describe('notificationFeed', () => {
  it('describes each notification and links to the post', async () => {
    const postId = await studentPostWithOwnerComment();
    const student = await as(SEED_IDS.student);
    expect(await notificationFeed(repo, student)).toEqual([
      {
        id: expect.any(String),
        text: 'Alexander commented on your post',
        link: { kind: 'post', community: 'community', postId },
        createdAt: NOW,
        unread: true,
      },
    ]);
    expect(await unreadCount(repo, student)).toBe(1);
    await markAllRead(repo, student, NOW);
    expect(await unreadCount(repo, student)).toBe(0);
    expect((await notificationFeed(repo, student))[0]?.unread).toBe(false);
  });

  it('links step comments to the lesson by program slug', async () => {
    await communityCommand(repo, await as(SEED_IDS.student),
      { op: 'createComment', target: { type: 'step', id: 'step-intro' }, parentId: null, body: 'q' },
      NOW,
      open,
    );
    const [item] = await notificationFeed(repo, await as(SEED_IDS.alexanderOwner));
    expect(item).toMatchObject({
      text: 'Robin (student) commented on Introduction',
      link: { kind: 'step', program: 'shibari-101', stepId: 'step-intro' },
    });
  });

  it('is empty for signed-out viewers', async () => {
    const guest = await as(null);
    expect(await notificationFeed(repo, guest)).toEqual([]);
    expect(await unreadCount(repo, guest)).toBe(0);
  });
});

describe('describeNotifications', () => {
  it('gives new rows the same text and link as the feed (push uses it)', async () => {
    const postId = await studentPostWithOwnerComment();
    const rows = [
      { recipientId: SEED_IDS.student, actorId: SEED_IDS.alexanderOwner, type: 'comment' as const, postId, stepId: null, communityId: null },
      { recipientId: SEED_IDS.alexanderOwner, actorId: SEED_IDS.student, type: 'step_comment' as const, postId: null, stepId: 'step-intro', communityId: null },
      { recipientId: SEED_IDS.assistant, actorId: SEED_IDS.student, type: 'report' as const, postId: null, stepId: null, communityId: SEED_IDS.community },
    ];
    expect(await describeNotifications(repo, SEED_IDS.alexander, rows)).toEqual([
      { recipientId: SEED_IDS.student, text: 'Alexander commented on your post', link: { kind: 'post', community: 'community', postId } },
      {
        recipientId: SEED_IDS.alexanderOwner,
        text: 'Robin (student) commented on Introduction',
        link: { kind: 'step', program: 'shibari-101', stepId: 'step-intro' },
      },
      { recipientId: SEED_IDS.assistant, text: 'Robin (student) reported content in Rope Community', link: { kind: 'reports', community: 'community' } },
    ]);
  });
});

describe('stepThread', () => {
  it('returns the thread when the step is open, null when shut', async () => {
    await repo.createComment({
      spaceId: SEED_IDS.alexander,
      targetType: 'step',
      targetId: 'step-intro',
      parentId: null,
      authorId: SEED_IDS.student,
      body: 'question',
      createdAt: NOW,
    });
    const student = await as(SEED_IDS.student);
    expect(await stepThread(repo, student, 'step-intro', shut)).toBeNull();
    const thread = await stepThread(repo, student, 'step-intro', open);
    expect(thread?.comments.map((c) => [c.body, c.canDelete])).toEqual([['question', true]]);
    expect(thread?.canComment).toBe(true);
    expect((await stepThread(repo, await as(null), 'step-intro', open))?.canComment).toBe(false);
  });
});
