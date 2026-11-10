// @vitest-environment node
// SQL mirrors of TS SSOTs must match. Edit TS first, then the migration.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALWAYS_REACH, MATRIX, ROLES } from '@/lib/auth/capabilities';
import { CURRENCIES, MAX_PRICE_CENTS } from '@/lib/commerce/money';
import {
  CHANNEL_VISIBILITIES,
  COMMENT_TARGETS,
  NOTIFICATION_TYPES,
  REACTION_EMOJIS,
  REACTION_TARGETS,
  LEGAL_KINDS,
  ORDER_PROVIDERS,
  ORDER_STATUSES,
  PAGE_KINDS,
  PAYMENT_ENVS,
} from '@/lib/data/types';
import { FONT_IDS } from '@/lib/fonts/catalog';
import { SECTION_KINDS } from '@/lib/site/sections';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/lib/tenancy/slug';
import { BRAND_INPUTS } from '@/tokens/brandInputs';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

/** First capture group of `re` as a list of SQL string literals. */
const list = (re: RegExp) =>
  sql
    .match(re)?.[1]
    .split(',')
    .map((s) => s.trim().replace(/'/g, ''));

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

describe('SQL mirrors: site', () => {
  it('pages kind check equals PAGE_KINDS', () => {
    expect(list(/pages_kind check \(kind in \(([^)]+)\)\)/)).toEqual([...PAGE_KINDS]);
  });

  it('pages legal_kind check equals LEGAL_KINDS', () => {
    expect(list(/pages_legal_kind check \(legal_kind in \(([^)]+)\)\)/)).toEqual([...LEGAL_KINDS]);
  });

  it('is_site_sections kinds equal SECTION_KINDS', () => {
    expect(list(/e ->> 'kind' in \(([^)]+)\)/)).toEqual([...SECTION_KINDS]);
  });

  it('pages slug check equals SLUG_PATTERN', () => {
    expect(sql.match(/pages_slug_format check \(slug ~ '([^']+)'\)/)?.[1]).toBe(SLUG_PATTERN.source);
  });
});

describe('SQL mirrors: commerce', () => {
  it('currency checks equal CURRENCIES', () => {
    const lists = [...sql.matchAll(/currency text not null check \(currency in \(([^)]+)\)\)/g)].map((m) =>
      m[1].split(',').map((s) => s.trim().replace(/'/g, '')),
    );
    expect(lists).toHaveLength(2);
    for (const l of lists) expect(l).toEqual([...CURRENCIES]);
  });

  it('offers price check equals MAX_PRICE_CENTS', () => {
    expect(Number(sql.match(/offers_price check \(price_cents between 0 and (\d+)\)/)?.[1])).toBe(MAX_PRICE_CENTS);
  });

  it('offers slug check equals SLUG_PATTERN', () => {
    expect(sql.match(/offers_slug_format check \(slug ~ '([^']+)'\)/)?.[1]).toBe(SLUG_PATTERN.source);
  });

  it('orders provider check equals ORDER_PROVIDERS', () => {
    expect(list(/orders_provider check \(provider in \(([^)]+)\)\)/)).toEqual([...ORDER_PROVIDERS]);
  });

  it('orders status check equals ORDER_STATUSES', () => {
    expect(list(/orders_status check \(status in \(([^)]+)\)\)/)).toEqual([...ORDER_STATUSES]);
  });

  it('payment_credentials env check equals PAYMENT_ENVS', () => {
    expect(list(/payment_credentials_env check \(env in \(([^)]+)\)\)/)).toEqual([...PAYMENT_ENVS]);
  });
});

describe('SQL mirrors: community', () => {
  it('channels visibility check equals CHANNEL_VISIBILITIES', () => {
    expect(list(/channels_visibility check \(visibility in \(([^)]+)\)\)/)).toEqual([...CHANNEL_VISIBILITIES]);
  });

  it('comments target check equals COMMENT_TARGETS', () => {
    expect(list(/comments_target check \(target_type in \(([^)]+)\)\)/)).toEqual([...COMMENT_TARGETS]);
  });

  it('reactions target check equals REACTION_TARGETS', () => {
    expect(list(/reactions_target check \(target_type in \(([^)]+)\)\)/)).toEqual([...REACTION_TARGETS]);
  });

  it('reactions emoji check equals REACTION_EMOJIS', () => {
    expect(list(/reactions_emoji check \(emoji in \(([^)]+)\)\)/)).toEqual([...REACTION_EMOJIS]);
  });

  it('notifications type check equals NOTIFICATION_TYPES', () => {
    expect(list(/notifications_type check \(type in \(([^)]+)\)\)/)).toEqual([...NOTIFICATION_TYPES]);
  });

  it('reaches_community role list equals ALWAYS_REACH', () => {
    expect(list(/m\.role = any \(array\[([^\]]+)\]\)/)).toEqual([...ALWAYS_REACH]);
  });
});
