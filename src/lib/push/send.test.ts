import { describe, expect, it, vi } from 'vitest';
import { createFakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { PushSubscription } from '@/lib/data/types';
import { sendPush, type PushMessage, type PushSend } from './send';

const sub = (profileId: string, endpoint: string, spaceId: string = SEED_IDS.alexander): PushSubscription => ({
  spaceId,
  profileId,
  endpoint,
  p256dh: 'k',
  auth: 'a',
  userAgent: null,
});

const msg = (recipientId: string, body = 'Alexander commented on your post', over: Partial<PushMessage> = {}): PushMessage => ({
  recipientId,
  type: 'comment',
  title: 'Alexander',
  body,
  url: '/community/c/p1',
  icon: null,
  ...over,
});

async function setup() {
  const repo = createFakeRepo(seedDb(new Date('2026-11-12T12:00:00Z')));
  await repo.savePushSubscription(sub(SEED_IDS.student, 'https://push.test/phone'));
  await repo.savePushSubscription(sub(SEED_IDS.student, 'https://push.test/laptop'));
  await repo.savePushSubscription(sub(SEED_IDS.alexanderOwner, 'https://push.test/owner'));
  await repo.savePushSubscription(sub(SEED_IDS.student, 'https://push.test/natasha', SEED_IDS.natasha));
  return repo;
}

describe('sendPush', () => {
  it('sends title, body and url to every device of each recipient on that space only', async () => {
    const repo = await setup();
    const send = vi.fn<PushSend>(async () => {});
    await sendPush({ repo, send, report: vi.fn() }, SEED_IDS.alexander, [msg(SEED_IDS.student)]);
    expect(send.mock.calls.map(([s]) => s.endpoint).sort()).toEqual(['https://push.test/laptop', 'https://push.test/phone']);
    expect(JSON.parse(send.mock.calls[0]![1])).toEqual({ title: 'Alexander', body: 'Alexander commented on your post', url: '/community/c/p1' });
  });

  it('adds the space icon to the payload when there is one', async () => {
    const repo = await setup();
    const send = vi.fn<PushSend>(async () => {});
    await sendPush({ repo, send, report: vi.fn() }, SEED_IDS.alexander, [msg(SEED_IDS.alexanderOwner, 'x', { icon: 'https://cdn.test/icon.png' })]);
    expect(JSON.parse(send.mock.calls[0]![1])).toMatchObject({ icon: 'https://cdn.test/icon.png' });
  });

  it('skips types the recipient muted for push on that space', async () => {
    const repo = await setup();
    await repo.setPushMute(SEED_IDS.alexander, SEED_IDS.student, 'reaction', true);
    await repo.setPushMute(SEED_IDS.natasha, SEED_IDS.student, 'comment', true);
    const send = vi.fn<PushSend>(async () => {});
    await sendPush({ repo, send, report: vi.fn() }, SEED_IDS.alexander, [
      msg(SEED_IDS.student, 'liked', { type: 'reaction' }),
      msg(SEED_IDS.student, 'commented'),
      msg(SEED_IDS.alexanderOwner, 'liked', { type: 'reaction' }),
    ]);
    const sent = send.mock.calls.map(([s, payload]) => `${s.endpoint} ${JSON.parse(payload).body}`).sort();
    expect(sent).toEqual(['https://push.test/laptop commented', 'https://push.test/owner liked', 'https://push.test/phone commented']);
  });

  it('does nothing without messages or subscriptions', async () => {
    const repo = await setup();
    const send = vi.fn(async () => {});
    await sendPush({ repo, send, report: vi.fn() }, SEED_IDS.alexander, []);
    await sendPush({ repo, send, report: vi.fn() }, SEED_IDS.alexander, [msg('user-nobody')]);
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes endpoints the push service says are gone (404/410)', async () => {
    const repo = await setup();
    const send = vi.fn(async (s: PushSubscription) => {
      if (s.endpoint.endsWith('phone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      if (s.endpoint.endsWith('laptop')) throw Object.assign(new Error('not found'), { statusCode: 404 });
    });
    const report = vi.fn();
    await sendPush({ repo, send, report }, SEED_IDS.alexander, [msg(SEED_IDS.student)]);
    expect(repo.db.pushSubscriptions.map((s) => s.endpoint).sort()).toEqual(['https://push.test/natasha', 'https://push.test/owner']);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports other failures with host and status only, keeps the row, still sends the rest', async () => {
    const repo = await setup();
    const send = vi.fn(async (s: PushSubscription) => {
      if (s.endpoint.endsWith('phone')) throw Object.assign(new Error('secret body'), { statusCode: 403 });
    });
    const report = vi.fn();
    await sendPush({ repo, send, report }, SEED_IDS.alexander, [msg(SEED_IDS.student, 'private words')]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(repo.db.pushSubscriptions).toHaveLength(4);
    expect(report).toHaveBeenCalledTimes(1);
    const reported = String((report.mock.calls[0]![0] as Error).message);
    expect(reported).toBe('Web push to push.test failed with status 403');
  });

  it('reports a network failure without the endpoint path', async () => {
    const repo = await setup();
    const send = vi.fn(async (s: PushSubscription) => {
      if (s.endpoint.endsWith('owner')) throw new Error('ECONNRESET');
    });
    const report = vi.fn();
    await sendPush({ repo, send, report }, SEED_IDS.alexander, [msg(SEED_IDS.alexanderOwner)]);
    expect((report.mock.calls[0]![0] as Error).message).toBe('Web push to push.test failed: ECONNRESET');
  });
});
