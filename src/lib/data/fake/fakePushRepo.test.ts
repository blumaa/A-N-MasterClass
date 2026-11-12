import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError, INVALID_PUSH_SUBSCRIPTION } from '../errors';
import type { PushSubscription } from '../types';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

let repo: FakeRepo;
beforeEach(() => {
  repo = createFakeRepo(seedDb(new Date('2026-11-12T12:00:00Z')));
});

const sub = (over: Partial<PushSubscription> = {}): PushSubscription => ({
  spaceId: SEED_IDS.alexander,
  profileId: SEED_IDS.student,
  endpoint: 'https://push.test/1',
  p256dh: 'k',
  auth: 'a',
  userAgent: null,
  ...over,
});

describe('push subscriptions', () => {
  it('saves one row per endpoint and finds it by space and profile', async () => {
    await repo.savePushSubscription(sub());
    await repo.savePushSubscription(sub({ p256dh: 'k2' }));
    expect(await repo.pushSubscriptions(SEED_IDS.alexander, [SEED_IDS.student])).toEqual([sub({ p256dh: 'k2' })]);
    expect(await repo.pushSubscriptions(SEED_IDS.natasha, [SEED_IDS.student])).toEqual([]);
    expect(await repo.pushSubscriptions(SEED_IDS.alexander, [SEED_IDS.alexanderOwner])).toEqual([]);
    expect(await repo.hasPushSubscription(SEED_IDS.alexander, SEED_IDS.student, sub().endpoint)).toBe(true);
    expect(await repo.hasPushSubscription(SEED_IDS.natasha, SEED_IDS.student, sub().endpoint)).toBe(false);
    expect(await repo.hasPushSubscription(SEED_IDS.alexander, SEED_IDS.alexanderOwner, sub().endpoint)).toBe(false);
  });

  it('moves an endpoint to the account that saves it last', async () => {
    await repo.savePushSubscription(sub());
    await repo.savePushSubscription(sub({ profileId: SEED_IDS.alexanderOwner }));
    expect(await repo.pushSubscriptions(SEED_IDS.alexander, [SEED_IDS.student, SEED_IDS.alexanderOwner])).toEqual([
      sub({ profileId: SEED_IDS.alexanderOwner }),
    ]);
  });

  it('needs a profile on the space', async () => {
    await expect(repo.savePushSubscription(sub({ profileId: 'user-nobody' }))).rejects.toThrow('no profile on this space');
  });

  it('checks endpoint and keys like the SQL checks', async () => {
    await expect(repo.savePushSubscription(sub({ endpoint: 'http://push.test/1' }))).rejects.toThrow(
      new ConstraintError(INVALID_PUSH_SUBSCRIPTION),
    );
    await expect(repo.savePushSubscription(sub({ auth: '' }))).rejects.toThrow(INVALID_PUSH_SUBSCRIPTION);
    await expect(repo.savePushSubscription(sub({ p256dh: 'x'.repeat(201) }))).rejects.toThrow(INVALID_PUSH_SUBSCRIPTION);
  });

  it('deletes own rows by endpoint and dead rows in bulk', async () => {
    await repo.savePushSubscription(sub());
    await repo.savePushSubscription(sub({ endpoint: 'https://push.test/2' }));
    await repo.deletePushSubscription(SEED_IDS.alexanderOwner, 'https://push.test/1');
    expect(repo.db.pushSubscriptions).toHaveLength(2);
    await repo.deletePushSubscription(SEED_IDS.student, 'https://push.test/1');
    expect(repo.db.pushSubscriptions.map((s) => s.endpoint)).toEqual(['https://push.test/2']);
    await repo.deletePushSubscriptions(['https://push.test/2']);
    expect(repo.db.pushSubscriptions).toEqual([]);
  });
});
