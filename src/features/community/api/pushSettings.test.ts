import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { NOTIFICATION_TYPES } from '@/lib/data/types';
import { PUSH_TYPE_LABELS } from '../components/labels';
import { pushTypeSettings, savePushTypes } from './pushSettings';

let repo: FakeRepo;
beforeEach(() => {
  repo = createFakeRepo(seedDb(new Date('2026-11-12T12:00:00Z')));
});

const as = async (profileId: string | null): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;

describe('push type settings', () => {
  it('has a label for every notification type', () => {
    expect(Object.keys(PUSH_TYPE_LABELS).sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it('starts with every type on', async () => {
    const settings = await pushTypeSettings(repo, await as(SEED_IDS.student));
    expect(settings.map((s) => [s.type, s.on])).toEqual(NOTIFICATION_TYPES.map((t) => [t, true]));
  });

  it('saves the checked types as on and the rest as off, on this space only', async () => {
    const viewer = await as(SEED_IDS.student);
    expect(await savePushTypes(repo, viewer, ['comment', 'mention'])).toEqual({ ok: true });
    const on = (await pushTypeSettings(repo, viewer)).filter((s) => s.on).map((s) => s.type);
    expect(on).toEqual(['comment', 'mention']);
    expect(await repo.pushMutes(SEED_IDS.natasha, [SEED_IDS.student])).toEqual([]);
    await savePushTypes(repo, viewer, [...NOTIFICATION_TYPES]);
    expect(await repo.pushMutes(SEED_IDS.alexander, [SEED_IDS.student])).toEqual([]);
  });

  it('refuses unknown types and visitors', async () => {
    expect(await savePushTypes(repo, await as(SEED_IDS.student), ['comment', 'nope'])).toEqual({
      ok: false,
      error: 'invalid',
      message: 'Unknown notification type.',
    });
    expect(await savePushTypes(repo, await as(null), [])).toEqual({ ok: false, error: 'forbidden' });
    expect(await pushTypeSettings(repo, await as(null))).toEqual([]);
  });
});
