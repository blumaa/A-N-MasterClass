import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { myProfile, saveMyProfile } from './profile';

const NOW = new Date('2026-11-10T12:00:00Z');
const { alexander, student } = SEED_IDS;
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

const AVATAR = `${alexander}/avatars/${student}/a-me.png`;

describe('myProfile', () => {
  it('is the viewer profile in this space', async () => {
    expect(await myProfile(repo, await as(student))).toEqual({
      spaceId: alexander,
      profileId: student,
      displayName: 'Robin (student)',
      avatarPath: null,
      bio: null,
    });
  });

  it('is null for a visitor', async () => {
    expect(await myProfile(repo, await as(null))).toBeNull();
  });

  it('falls back to the viewer name when the space has no row yet', async () => {
    repo.db.spaceProfiles = repo.db.spaceProfiles.filter((p) => p.profileId !== student);
    expect(await myProfile(repo, await as(student))).toMatchObject({ displayName: 'student@example.test', bio: null });
  });
});

describe('saveMyProfile', () => {
  it('saves name, bio and avatar, trimmed; blank bio becomes null', async () => {
    const viewer = await as(student);
    expect(await saveMyProfile(repo, viewer, { displayName: '  Robin K ', bio: '  ', avatarPath: AVATAR })).toEqual({ ok: true });
    expect(await myProfile(repo, viewer)).toMatchObject({ displayName: 'Robin K', bio: null, avatarPath: AVATAR });
  });

  it('touches only this space', async () => {
    await saveMyProfile(repo, await as(student), { displayName: 'Robin K', bio: 'Hi', avatarPath: null });
    expect(await myProfile(repo, await as(student, 'natasha'))).toMatchObject({ displayName: 'Robin (student)', bio: null });
  });

  it('creates the row when the space has none yet', async () => {
    repo.db.spaceProfiles = repo.db.spaceProfiles.filter((p) => p.profileId !== student);
    const viewer = await as(student);
    expect(await saveMyProfile(repo, viewer, { displayName: 'Robin', bio: 'Hi', avatarPath: null })).toEqual({ ok: true });
    expect(await myProfile(repo, viewer)).toMatchObject({ displayName: 'Robin', bio: 'Hi' });
  });

  it('forbids visitors', async () => {
    expect(await saveMyProfile(repo, await as(null), { displayName: 'X', bio: null, avatarPath: null })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it.each([
    [{ displayName: '   ' }, 'Enter a name.'],
    [{ displayName: 'x'.repeat(81) }, 'Name must be 80 characters or fewer.'],
    [{ bio: 'x'.repeat(1001) }, 'Bio must be 1000 characters or fewer.'],
    [{ avatarPath: `${alexander}/avatars/${SEED_IDS.assistant}/a.png` }, 'Upload the image again.'],
    [{ avatarPath: `${alexander}/site/a.png` }, 'Upload the image again.'],
  ])('refuses %o', async (patch, message) => {
    const input = { displayName: 'Robin', bio: null, avatarPath: null, ...patch };
    expect(await saveMyProfile(repo, await as(student), input)).toEqual({ ok: false, error: 'invalid', message });
  });
});
