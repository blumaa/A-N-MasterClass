// Postgres constraint name -> the text the fake repo throws for the same rule (src/lib/data/fake).
// Features show ConstraintError.message or match it (e.g. checkout/api/offers.ts), so both data
// sources must say the same thing. Names: supabase/migrations. Unknown names keep Postgres' text.
import { SESSION_OVERLAP } from '@/lib/data/errors';
import { bodyRangeMessage, COMMENT_MAX, ENTRY_MAX, MESSAGE_MAX, POST_MAX } from '@/lib/data/limits';

const SLUG_TAKEN = 'slug taken';
const INVALID_SLUG = 'invalid slug';
const GROUP_IN_USE = 'group in use';
const END_AFTER_START = 'end must be after start';

const BY_NAME: Readonly<Record<string, string>> = {
  offers_slug_taken: SLUG_TAKEN,
  products_space_id_slug_key: SLUG_TAKEN,
  pages_space_id_kind_slug_key: SLUG_TAKEN,
  spaces_slug_key: SLUG_TAKEN,
  offers_slug_format: INVALID_SLUG,
  pages_slug_format: INVALID_SLUG,
  products_slug_check: INVALID_SLUG,
  spaces_slug_format: INVALID_SLUG,
  spaces_slug_reserved: 'slug reserved',
  offers_price: 'price out of range',
  // Only deleting an offer can break it: orders are created by the service path with a known offer.
  orders_offer_id_fkey: 'offer has orders',
  orders_provider_provider_order_id_key: 'provider order id taken',
  orders_provider_capture_id_key: 'capture id taken',
  // access_groups FKs are on delete restrict; inserts with a wrong group hit the
  // group_matches_product trigger first, so these fire only when deleting a group in use.
  grants_access_group: GROUP_IN_USE,
  offer_products_access_group: GROUP_IN_USE,
  channels_access_group_id_fkey: GROUP_IN_USE,
  challenges_access_group_id_fkey: GROUP_IN_USE,
  meetups_access_group_id_fkey: GROUP_IN_USE,
  grants_one_active: 'active grant exists',
  pages_one_home: 'space already has a home page',
  pages_home_is_page: 'home must be a page',
  pages_one_legal_kind: 'legal page taken',
  access_groups_one_default: 'a community has one default group',
  dm_threads_community_id_a_id_b_id_key: 'thread exists',
  modules_release_after_days_check: 'release_after_days >= 0',
  parts_vimeo_id_check: 'vimeo id must be digits',
  posts_body_check: bodyRangeMessage(POST_MAX),
  comments_body_check: bodyRangeMessage(COMMENT_MAX),
  messages_body_check: bodyRangeMessage(MESSAGE_MAX),
  challenge_entries_body: bodyRangeMessage(ENTRY_MAX),
  coaching_sessions_no_overlap: SESSION_OVERLAP,
  coaching_sessions_range: END_AFTER_START,
  meetups_window: END_AFTER_START,
  challenges_window: END_AFTER_START,
};

const TITLE_CHECK = /_title(_check)?$/;
const NAME = /constraint "([^"]+)"/;

/** Canonical text for the constraint named in a Postgres message, or null when unknown. */
export function constraintMessage(pgMessage: string): string | null {
  const name = NAME.exec(pgMessage)?.[1];
  if (!name) return null;
  return BY_NAME[name] ?? (TITLE_CHECK.test(name) ? 'title required' : null);
}
