import { describe, expect, it } from 'vitest';
import { createFakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { resolveViewer } from './viewer';

const repo = () => createFakeRepo(seedDb(new Date('2026-11-10T12:00:00Z')));

describe('resolveViewer', () => {
  it('null when the space does not exist', async () => {
    expect(await resolveViewer(repo(), 'nobody', null)).toBeNull();
  });

  it('anonymous visitor: no profile, no role', async () => {
    const v = await resolveViewer(repo(), 'alexander', null);
    expect(v?.space.slug).toBe('alexander');
    expect(v?.profile).toBeNull();
    expect(v?.role).toBeNull();
  });

  it('staff gets role and display name of this space', async () => {
    const v = await resolveViewer(repo(), 'alexander', SEED_IDS.assistant);
    expect(v?.role).toBe('assistant');
    expect(v?.displayName).toBe('Sam (assistant)');
  });

  it('owner of one space is nobody special in the other', async () => {
    const v = await resolveViewer(repo(), 'natasha', SEED_IDS.alexanderOwner);
    expect(v?.role).toBeNull();
  });

  it('unknown profile id = anonymous (stale cookie)', async () => {
    const v = await resolveViewer(repo(), 'alexander', 'ghost');
    expect(v?.profile).toBeNull();
  });
});
