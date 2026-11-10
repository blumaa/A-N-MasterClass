// @vitest-environment node
// SQL mirrors of TS SSOTs must match. Edit TS first, then the migration.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MATRIX, ROLES } from '@/lib/auth/capabilities';
import { FONT_IDS } from '@/lib/fonts/catalog';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/lib/tenancy/slug';
import { BRAND_INPUTS } from '@/tokens/brandInputs';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

describe('SQL mirrors', () => {
  it('spaces slug check equals SLUG_PATTERN', () => {
    const match = sql.match(/spaces_slug_format check \(slug ~ '([^']+)'\)/);
    expect(match?.[1]).toBe(SLUG_PATTERN.source);
  });

  it('spaces reserved list equals RESERVED_SLUGS', () => {
    const match = sql.match(/spaces_slug_reserved check \(slug not in \(([^)]+)\)\)/);
    const list = match?.[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(list?.toSorted()).toEqual([...RESERVED_SLUGS].toSorted());
  });

  it('role_capabilities seed equals MATRIX', () => {
    const seed = sql.match(/insert into public\.role_capabilities \(role, capability\) values([\s\S]+?);/)?.[1] ?? '';
    const rows = [...seed.matchAll(/\('(\w+)', '([\w.]+)'\)/g)].map(([, role, cap]) => `${role}:${cap}`);
    const expected = ROLES.flatMap((role) => MATRIX[role].map((cap) => `${role}:${cap}`));
    expect(rows.toSorted()).toEqual(expected.toSorted());
  });

  it('role check lists equal ROLES', () => {
    const lists = [...sql.matchAll(/role in \(([^)]+)\)/g)].map((m) => m[1].replace(/['\s]/g, '').split(','));
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) expect(list).toEqual([...ROLES]);
  });
});

describe('SQL mirrors: branding', () => {
  it('is_brand_colors keys equal BRAND_INPUTS', () => {
    const list = sql.match(/from unnest\(array\[([^\]]+)\]\) as k/)?.[1];
    expect(list?.split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual([...BRAND_INPUTS]);
  });

  it('font checks equal FONT_IDS', () => {
    const lists = [...sql.matchAll(/font_(?:heading|body) text check \(font_\w+ in \(([^)]+)\)\)/g)].map((m) =>
      m[1].split(',').map((s) => s.trim().replace(/'/g, '')),
    );
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list).toEqual([...FONT_IDS]);
  });
});
