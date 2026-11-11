import { describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo } from '@/lib/data/fake/fakeRepo';
import { asPlatformAdmin } from './platformAdmin';

describe('asPlatformAdmin', () => {
  it('returns the profile only when it carries the platform admin flag', async () => {
    const repo = createFakeRepo(emptyDb());
    const admin = await repo.createProfile('root@example.com');
    const user = await repo.createProfile('user@example.com');
    repo.db.profiles.find((p) => p.id === admin.id)!.isPlatformAdmin = true;

    expect((await asPlatformAdmin(repo, admin.id))?.id).toBe(admin.id);
    expect(await asPlatformAdmin(repo, user.id)).toBeNull();
    expect(await asPlatformAdmin(repo, null)).toBeNull();
  });
});
