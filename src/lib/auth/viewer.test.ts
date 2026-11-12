import { describe, expect, it } from 'vitest';
import { createFakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { Role } from '@/lib/data/types';
import { canSeeSpace, resolveViewer, type Viewer } from './viewer';

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

describe('canSeeSpace', () => {
  const space = { id: 's', slug: 's', name: 'S', status: 'draft', locale: 'en', isTest: false } as const;
  const student = { id: 'p', email: 'p@example.com', isPlatformAdmin: false };
  type Over = { space?: Viewer['space']; profile?: typeof student; role?: Role };
  const viewer = ({ space: sp = space, profile, role }: Over = {}): Viewer =>
    profile ? { space: sp, profile, role: role ?? null, displayName: 'P' } : { space: sp, profile: null, role: null, displayName: null };

  it('live space: everyone', () => {
    expect(canSeeSpace(viewer({ space: { ...space, status: 'live' } }))).toBe(true);
  });

  it('draft or archived space: anonymous and students are kept out', () => {
    expect(canSeeSpace(viewer())).toBe(false);
    expect(canSeeSpace(viewer({ profile: student }))).toBe(false);
    expect(canSeeSpace(viewer({ space: { ...space, status: 'archived' }, profile: student }))).toBe(false);
  });

  it('draft space: staff and platform admins get in', () => {
    expect(canSeeSpace(viewer({ profile: student, role: 'support' }))).toBe(true);
    expect(canSeeSpace(viewer({ profile: { ...student, isPlatformAdmin: true } }))).toBe(true);
  });
});
