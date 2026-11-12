import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { NewNotification } from '@/lib/data/repo';
import type { Space } from '@/lib/data/types';
import { pushMessages, withPush } from './pushNotifications';

let repo: FakeRepo;
let space: Space;
beforeEach(async () => {
  repo = createFakeRepo(seedDb(new Date('2026-11-12T12:00:00Z')));
  space = (await repo.spaceBySlug('alexander'))!;
});

const stepRow: NewNotification = {
  spaceId: SEED_IDS.alexander,
  recipientId: SEED_IDS.alexanderOwner,
  actorId: SEED_IDS.student,
  type: 'step_comment',
  postId: null,
  stepId: 'step-intro',
  communityId: null,
  createdAt: new Date('2026-11-12T12:00:00Z'),
};

describe('pushMessages', () => {
  it('uses the space name as title, the in-app text as body and a path on the space host', async () => {
    expect(await pushMessages(repo, space, [stepRow], null)).toEqual([
      {
        recipientId: SEED_IDS.alexanderOwner,
        type: 'step_comment',
        title: space.name,
        body: 'Robin (student) commented on Introduction',
        url: '/programs/shibari-101/step-intro',
        icon: null,
      },
    ]);
  });

  it('carries each row type and the space icon', async () => {
    const reaction: NewNotification = { ...stepRow, type: 'reaction' };
    const messages = await pushMessages(repo, space, [stepRow, reaction], '/icon.png');
    expect(messages.map((m) => [m.type, m.icon])).toEqual([
      ['step_comment', '/icon.png'],
      ['reaction', '/icon.png'],
    ]);
  });
});

describe('withPush', () => {
  it('writes first, then schedules the push after the response', async () => {
    const scheduled: (() => Promise<void>)[] = [];
    const push = vi.fn(async () => {});
    const wrapped = withPush(repo, (task) => scheduled.push(task), push);
    await wrapped.addNotifications([stepRow]);
    expect(await repo.unreadNotificationCount(SEED_IDS.alexander, SEED_IDS.alexanderOwner)).toBe(1);
    expect(push).not.toHaveBeenCalled();
    await scheduled[0]!();
    expect(push).toHaveBeenCalledWith([stepRow]);
  });

  it('keeps every other repo method', () => {
    const wrapped = withPush(repo, vi.fn(), vi.fn());
    expect(wrapped.spaceBySlug).toBe(repo.spaceBySlug);
  });
});
