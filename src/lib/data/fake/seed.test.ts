import { describe, expect, it } from 'vitest';
import { seedDb, SEED_IDS } from './seed';

describe('seedDb', () => {
  it('has one platform admin who owns no space, so platform pages work in dev', () => {
    const db = seedDb();
    const admins = db.profiles.filter((p) => p.isPlatformAdmin);
    expect(admins.map((p) => p.id)).toEqual([SEED_IDS.platformAdmin]);
    expect(db.members.some((m) => m.profileId === SEED_IDS.platformAdmin)).toBe(false);
  });
});
