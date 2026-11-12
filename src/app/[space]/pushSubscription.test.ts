import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { forgetPush, isPushSaved, parsePushKeys, savePush } from './pushSubscription';

let repo: FakeRepo;
let viewer: Viewer;
beforeEach(async () => {
  repo = createFakeRepo(seedDb(new Date('2026-11-12T12:00:00Z')));
  viewer = (await resolveViewer(repo, 'alexander', SEED_IDS.student))!;
});

const KEYS = { endpoint: 'https://push.test/1', p256dh: 'k', auth: 'a' };

describe('parsePushKeys', () => {
  it('takes the endpoint and keys of PushSubscription.toJSON()', () => {
    expect(parsePushKeys({ endpoint: KEYS.endpoint, keys: { p256dh: 'k', auth: 'a' }, expirationTime: null })).toEqual(KEYS);
  });

  it('refuses anything else', () => {
    expect(parsePushKeys(null)).toBeNull();
    expect(parsePushKeys({ endpoint: KEYS.endpoint })).toBeNull();
    expect(parsePushKeys({ endpoint: 1, keys: { p256dh: 'k', auth: 'a' } })).toBeNull();
  });
});

describe('savePush', () => {
  it('saves on the viewer space for the viewer, with a capped user agent', async () => {
    expect(await savePush(repo, viewer, KEYS, 'x'.repeat(600))).toEqual({ ok: true });
    expect(repo.db.pushSubscriptions).toEqual([
      { spaceId: SEED_IDS.alexander, profileId: SEED_IDS.student, ...KEYS, userAgent: 'x'.repeat(500) },
    ]);
    expect(await isPushSaved(repo, viewer, KEYS.endpoint)).toBe(true);
  });

  it('says why a bad subscription is refused', async () => {
    expect(await savePush(repo, viewer, { ...KEYS, endpoint: 'http://push.test/1' }, null)).toEqual({
      ok: false,
      message: 'This browser gave an invalid push subscription.',
    });
  });

  it('needs a signed-in profile', async () => {
    const guest = (await resolveViewer(repo, 'alexander', null))!;
    expect(await savePush(repo, guest, KEYS, null)).toEqual({ ok: false, message: 'Sign in to turn on push.' });
    expect(await isPushSaved(repo, guest, KEYS.endpoint)).toBe(false);
  });
});

describe('forgetPush', () => {
  it('deletes the viewer row for that endpoint', async () => {
    await savePush(repo, viewer, KEYS, null);
    await forgetPush(repo, viewer, KEYS.endpoint);
    expect(repo.db.pushSubscriptions).toEqual([]);
  });
});
