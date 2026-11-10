import { describe, expect, it } from 'vitest';
import { contrastFailures } from './contrast';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';

describe('seed branding', () => {
  it('gives Natasha her own brand, which passes the MDS contrast contract', () => {
    const row = seedDb().branding.find((b) => b.spaceId === SEED_IDS.natasha);
    expect(row?.colors).not.toBeNull();
    expect(contrastFailures(row!.colors!)).toEqual([]);
  });
});
