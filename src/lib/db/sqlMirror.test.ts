// @vitest-environment node
// SQL mirrors of TS SSOTs must match. Edit TS first, then the migration.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALWAYS_REACH, MATRIX, ROLES } from '@/lib/auth/capabilities';
import { CURRENCIES, MAX_PRICE_CENTS } from '@/lib/commerce/money';
import { INSTALLMENT_LIMITS, TRIAL_DAYS_MAX } from '@/lib/commerce/recurring';
import {
  CHANNEL_KINDS,
  CHANNEL_PRIVACIES,
  COMMENT_TARGETS,
  DEFAULT_POINT_VALUES,
  EPISODE_MAX_BYTES,
  EPISODE_TYPES,
  LEADERBOARD_VISIBILITIES,
  NOTIFICATION_TYPES,
  BILLING_INTERVALS,
  OFFER_KINDS,
  SUBSCRIPTION_STATUSES,
  REACTION_EMOJIS,
  REACTION_TARGETS,
  LEGAL_KINDS,
  MODERATION_ACTIONS,
  ORDER_PROVIDERS,
  ORDER_STATUSES,
  PAGE_KINDS,
  PAYMENT_ENVS,
  PODCAST_ORDERS,
  POST_STATUSES,
  POINT_REASONS,
  POINT_VALUE_MAX,
  REPEAT_COUNT_MAX,
  REPEAT_EVERY_MAX,
  REPEAT_FREQS,
  REPORT_STATUSES,
} from '@/lib/data/types';
import { FONT_IDS } from '@/lib/fonts/catalog';
import { SECTION_KINDS } from '@/lib/site/sections';
import { ATTACHMENT_TYPES, COMMUNITY_MAX_BYTES, POST_PHOTOS_MAX } from '@/lib/storage/communityFiles';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/lib/tenancy/slug';
import { BRAND_INPUTS } from '@/tokens/brandInputs';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

/** First capture group of the last match of `re` (latest migration wins) as a list of SQL string literals. */
const list = (re: RegExp) =>
  [...sql.matchAll(new RegExp(re.source, 'g'))]
    .at(-1)?.[1]
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
  it('currency checks (offers, orders, subscriptions, payments) equal CURRENCIES', () => {
    const lists = [...sql.matchAll(/currency text not null check \(currency in \(([^)]+)\)\)/g)].map((m) =>
      m[1].split(',').map((s) => s.trim().replace(/'/g, '')),
    );
    expect(lists).toHaveLength(4);
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

  it('offers kind check equals OFFER_KINDS', () => {
    expect(list(/offers_kind check \(kind in \(([^)]+)\)\)/)).toEqual([...OFFER_KINDS]);
  });

  it('billing interval checks equal BILLING_INTERVALS', () => {
    expect(list(/offers_billing_interval check \(billing_interval in \(([^)]+)\)\)/)).toEqual([...BILLING_INTERVALS]);
    expect(list(/subscriptions_billing_interval check \(billing_interval in \(([^)]+)\)\)/)).toEqual([
      ...BILLING_INTERVALS,
    ]);
  });

  it('subscriptions status check equals SUBSCRIPTION_STATUSES', () => {
    expect(list(/subscriptions_status check \(status in \(([^)]+)\)\)/)).toEqual([...SUBSCRIPTION_STATUSES]);
  });

  it('offer trial and installment limits equal recurring.ts', () => {
    expect(sql).toContain(`offers_trial_days check (trial_days between 1 and ${TRIAL_DAYS_MAX})`);
    const { week, month, year } = INSTALLMENT_LIMITS;
    expect(week.min === 2 && month.min === 2 && year.min === 2).toBe(true);
    expect(sql).toContain(
      `installments between 2 and case billing_interval when 'week' then ${week.max} when 'month' then ${month.max} else ${year.max} end`,
    );
  });

  it('payment_credentials env check equals PAYMENT_ENVS', () => {
    expect(list(/payment_credentials_env check \(env in \(([^)]+)\)\)/)).toEqual([...PAYMENT_ENVS]);
  });
});

describe('SQL mirrors: community', () => {
  it('channels kind check equals CHANNEL_KINDS', () => {
    expect(list(/channels_kind check \(kind in \(([^)]+)\)\)/)).toEqual([...CHANNEL_KINDS]);
  });

  it('channels privacy check equals CHANNEL_PRIVACIES', () => {
    expect(list(/channels_privacy check \(privacy in \(([^)]+)\)\)/)).toEqual([...CHANNEL_PRIVACIES]);
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

  it('posts status check equals POST_STATUSES', () => {
    expect(list(/posts_status check \(status in \(([^)]+)\)\)/)).toEqual([...POST_STATUSES]);
  });

  it('reports status check equals REPORT_STATUSES', () => {
    expect(list(/reports_status check \(status in \(([^)]+)\)\)/)).toEqual([...REPORT_STATUSES]);
  });

  it('moderation_log action check equals MODERATION_ACTIONS', () => {
    expect(list(/moderation_log_action check \(action in \(([^)]+)\)\)/)).toEqual([...MODERATION_ACTIONS]);
  });

  it('reaches_community role list equals ALWAYS_REACH', () => {
    expect(list(/m\.role = any \(array\[([^\]]+)\]\)/)).toEqual([...ALWAYS_REACH]);
  });

  it('points ledger reason check and point_values keys equal POINT_REASONS', () => {
    expect(list(/points_ledger_reason check \(reason in \(([^)]+)\)\)/)).toEqual([...POINT_REASONS]);
    expect(list(/e\.key not in \(([^)]+)\)/)).toEqual([...POINT_REASONS]);
  });

  it('community_settings leaderboard check equals LEADERBOARD_VISIBILITIES', () => {
    expect(list(/community_settings_leaderboard check \(leaderboard in \(([^)]+)\)\)/)).toEqual([
      ...LEADERBOARD_VISIBILITIES,
    ]);
  });

  it('point limits equal POINT_VALUE_MAX', () => {
    expect(sql).toContain(`not between 0 and ${POINT_VALUE_MAX}`);
    expect(sql).toContain(`check (points between 1 and ${POINT_VALUE_MAX})`);
  });

  it('point_value defaults equal DEFAULT_POINT_VALUES', () => {
    const defaults = Object.fromEntries(
      [...sql.matchAll(/when '(\w+)' then (\d+)/g)]
        .filter(([, reason]) => (POINT_REASONS as readonly string[]).includes(reason))
        .map(([, reason, value]) => [reason, Number(value)]),
    );
    expect(defaults).toEqual(DEFAULT_POINT_VALUES);
  });
});

describe('SQL mirrors: podcasts', () => {
  it('podcast_settings order check equals PODCAST_ORDERS', () => {
    expect(list(/podcast_settings_order check \(episode_order in \(([^)]+)\)\)/)).toEqual([...PODCAST_ORDERS]);
  });

  it('episodes type check equals EPISODE_TYPES', () => {
    expect(list(/episodes_type check \(type in \(([^)]+)\)\)/)).toEqual([...EPISODE_TYPES]);
  });

  it('episode size limit and bucket limit equal EPISODE_MAX_BYTES', () => {
    expect(sql).toContain(`check (audio_bytes between 1 and ${EPISODE_MAX_BYTES})`);
    expect(sql).toContain(`('resources', 'resources', false, ${EPISODE_MAX_BYTES})`);
  });

  it('community bucket limit and types equal COMMUNITY_MAX_BYTES and ATTACHMENT_TYPES', () => {
    expect(sql).toContain(`('community', 'community', false, ${COMMUNITY_MAX_BYTES}, array[`);
    const types = sql.match(/\('community', 'community', false, \d+, array\[([\s\S]+?)\]\)/)?.[1];
    expect(types?.split(',').map((t) => t.trim().replace(/'/g, ''))).toEqual([...ATTACHMENT_TYPES]);
  });

  it('post photos trigger cap equals POST_PHOTOS_MAX', () => {
    expect(sql).toContain(`where p.post_id = new.post_id) >= ${POST_PHOTOS_MAX} then`);
  });
});

describe('SQL mirrors: meetups', () => {
  it('meetups repeat_freq check equals REPEAT_FREQS', () => {
    expect(list(/meetups_repeat_freq check \(repeat_freq in \(([^)]+)\)\)/)).toEqual([...REPEAT_FREQS]);
  });

  it('repeat limits equal REPEAT_EVERY_MAX and REPEAT_COUNT_MAX', () => {
    expect(sql).toContain(`repeat_every between 1 and ${REPEAT_EVERY_MAX}`);
    expect(sql).toContain(`repeat_count between 1 and ${REPEAT_COUNT_MAX}`);
  });
});
