// Postgres constraint name -> the text the fake repo throws for the same rule (src/lib/data/fake).
// Features show ConstraintError.message or match it (e.g. checkout/api/offers.ts), so both data
// sources must say the same thing. Names: supabase/migrations. Unknown names keep Postgres' text.
import {
  ALREADY_MEMBER,
  ALREADY_REPORTED,
  ATTACHMENT_INCOMPLETE,
  FILE_IN_USE,
  FILE_OUTSIDE_FOLDER,
  HOST_TAKEN,
  INVALID_PUSH_SUBSCRIPTION,
  INVALID_REPEAT,
  OCCURRENCE_MISSING,
  ONE_PRIMARY_DOMAIN,
  REPORT_TARGET_MISSING,
  SESSION_OVERLAP,
  SLUG_RESERVED,
  TOO_MANY_PHOTOS,
} from '@/lib/data/errors';
import { bodyRangeMessage, COMMENT_MAX, ENTRY_MAX, MESSAGE_MAX, POST_MAX, REPORT_REASON_RANGE } from '@/lib/data/limits';

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
  spaces_slug_reserved: SLUG_RESERVED,
  space_domains_pkey: HOST_TAKEN,
  space_domains_one_primary: ONE_PRIMARY_DOMAIN,
  space_members_pkey: ALREADY_MEMBER,
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
  parts_file_size_check: 'file size >= 0',
  posts_body_check: bodyRangeMessage(POST_MAX),
  comments_body_check: bodyRangeMessage(COMMENT_MAX),
  messages_body_check: bodyRangeMessage(MESSAGE_MAX),
  challenge_entries_body: bodyRangeMessage(ENTRY_MAX),
  coaching_sessions_no_overlap: SESSION_OVERLAP,
  coaching_sessions_range: END_AFTER_START,
  meetups_window: END_AFTER_START,
  meetups_repeat: INVALID_REPEAT,
  meetups_repeat_freq: INVALID_REPEAT,
  meetup_occurrences_window: END_AFTER_START,
  meetup_occurrences_description: 'description too long',
  meetup_occurrences_replay: 'vimeo id must be digits',
  // Raised by the meetup_occurrences_exists trigger and split_meetup.
  meetup_occurrence_missing: OCCURRENCE_MISSING,
  challenges_window: END_AFTER_START,
  reports_once: ALREADY_REPORTED,
  reports_reason: REPORT_REASON_RANGE,
  // Raised by the reports_target trigger: no post, post comment or channel line with that id.
  reports_target_missing: REPORT_TARGET_MISSING,
  // Community files: the path triggers raise these names (post_photos_check, messages_attachment_check).
  post_photos_path: FILE_OUTSIDE_FOLDER,
  messages_attachment_path: FILE_OUTSIDE_FOLDER,
  post_photos_path_key: FILE_IN_USE,
  messages_attachment_path_key: FILE_IN_USE,
  post_photos_max: TOO_MANY_PHOTOS,
  messages_attachment: ATTACHMENT_INCOMPLETE,
  push_subscriptions_endpoint_https: INVALID_PUSH_SUBSCRIPTION,
  push_subscriptions_p256dh: INVALID_PUSH_SUBSCRIPTION,
  push_subscriptions_auth: INVALID_PUSH_SUBSCRIPTION,
  push_subscriptions_user_agent: INVALID_PUSH_SUBSCRIPTION,
};

const TITLE_CHECK = /_title(_check)?$/;
const NAME = /constraint "([^"]+)"/;

/** Canonical text for the constraint named in a Postgres message, or null when unknown. */
export function constraintMessage(pgMessage: string): string | null {
  const name = NAME.exec(pgMessage)?.[1];
  if (!name) return null;
  return BY_NAME[name] ?? (TITLE_CHECK.test(name) ? 'title required' : null);
}
