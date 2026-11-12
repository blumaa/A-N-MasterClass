import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from '@/lib/storage/fileStore';
import { deleteMyAccount, exportMyData } from './memberData';

const NOW = new Date('2026-11-12T12:00:00Z');
const { alexander, natasha, student, alexanderOwner } = SEED_IDS;
let repo: FakeRepo;
let files: { site: ReturnType<typeof createFakeFileStore>; community: ReturnType<typeof createFakeFileStore> };

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
  files = { site: createFakeFileStore(undefined, 'site'), community: createFakeFileStore(undefined, 'community') };
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

describe('exportMyData', () => {
  it('is the member data of this space', async () => {
    const data = await exportMyData(repo, await as(student));
    expect(data).toMatchObject({ account: { email: 'student@example.test' } });
  });

  it('is null for a visitor', async () => {
    expect(await exportMyData(repo, await as(null))).toBeNull();
  });
});

describe('deleteMyAccount', () => {
  it('is forbidden for a visitor', async () => {
    expect(await deleteMyAccount(repo, files, await as(null))).toEqual({ ok: false, error: 'forbidden' });
  });

  it('refuses the owner with a message', async () => {
    const result = await deleteMyAccount(repo, files, await as(alexanderOwner));
    expect(result).toMatchObject({ ok: false, error: 'invalid' });
    expect(repo.db.members.some((m) => m.spaceId === alexander && m.profileId === alexanderOwner)).toBe(true);
  });

  it('erases this space, removes files, keeps the account while another space remains', async () => {
    repo.db.spaceProfiles.find((p) => p.spaceId === alexander && p.profileId === student)!.avatarPath = 'a.png';
    expect(await deleteMyAccount(repo, files, await as(student))).toEqual({ ok: true, accountDeleted: false });
    expect(files.site.removed).toEqual(['a.png']);
    expect(repo.db.spaceProfiles.some((p) => p.spaceId === alexander && p.profileId === student)).toBe(false);
    expect(await repo.profile(student)).not.toBeNull();
  });

  it('deletes the global account when the last space is left', async () => {
    await deleteMyAccount(repo, files, await as(student));
    expect(await deleteMyAccount(repo, files, await as(student, 'natasha'))).toEqual({ ok: true, accountDeleted: true });
    expect(await repo.profile(student)).toBeNull();
    expect(repo.db.members.some((m) => m.spaceId === natasha && m.profileId === student)).toBe(false);
  });
});
