import { describe, expect, it } from 'vitest';
import { createFakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { canSignInAs, devProfiles } from './devProfiles';

const repo = createFakeRepo(seedDb(new Date('2026-11-10T12:00:00Z')));
const space = repo.db.spaces.find((s) => s.id === SEED_IDS.alexander)!;

describe('devProfiles', () => {
  it('lists staff and students of the space with roles', async () => {
    const list = await devProfiles(repo, space);
    expect(list.map((p) => [p.displayName, p.role])).toEqual(
      expect.arrayContaining([
        ['Alexander', 'owner'],
        ['Sam (assistant)', 'assistant'],
        ['Robin (student)', null],
      ]),
    );
    expect(list.some((p) => p.id === SEED_IDS.natashaOwner)).toBe(false);
  });

  it('refuses a profile from another space', async () => {
    expect(await canSignInAs(repo, space, SEED_IDS.student)).toBe(true);
    expect(await canSignInAs(repo, space, SEED_IDS.natashaOwner)).toBe(false);
  });
});
