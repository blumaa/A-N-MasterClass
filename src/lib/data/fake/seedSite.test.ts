import { describe, expect, it } from 'vitest';
import { validateSection } from '@/lib/site/sections';
import { seedDb, SEED_IDS } from './seed';
import { seedSite } from './seedSite';

const db = seedSite(seedDb(new Date('2026-11-10T12:00:00Z')));

describe('seedSite', () => {
  it('gives each dev space a published home page and all three legal pages', () => {
    for (const spaceId of [SEED_IDS.alexander, SEED_IDS.natasha]) {
      const pages = db.pages.filter((p) => p.spaceId === spaceId && p.published);
      expect(pages.filter((p) => p.isHome)).toHaveLength(1);
      expect(pages.map((p) => p.legalKind).filter(Boolean).toSorted()).toEqual(['imprint', 'privacy', 'terms']);
    }
  });

  it('only stores sections that pass their spec', () => {
    for (const page of db.pages) {
      for (const s of [...page.draft, ...(page.published ?? [])]) {
        expect(validateSection(s, s.fields, s.items), `${page.slug}/${s.id}`).toMatchObject({ ok: true });
      }
    }
  });

  it('keeps slugs unique per space and kind', () => {
    const keys = db.pages.map((p) => `${p.spaceId}/${p.kind}/${p.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
