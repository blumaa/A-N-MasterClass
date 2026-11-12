// Postgres constraint name -> the text the fake repo throws for the same rule (src/lib/data/fake).
// Features show ConstraintError.message or match it (e.g. checkout/api/offers.ts), so both data
// sources must say the same thing. Names: supabase/migrations. Unknown names keep Postgres' text.
import {
  ALREADY_MEMBER,
  ALREADY_REPORTED,
  ATTACHMENT_INCOMPLETE,
  CERTIFICATE_NOT_EARNED,
  CERTIFICATES_OFF,
  CERTIFICATES_PROGRAM_ONLY,
  COUPON_CODE,
  COUPON_CODE_TAKEN,
  COUPON_DISCOUNT,
  COUPON_HAS_ORDERS,
  COUPON_MAX_USES,
  COUPON_OFFER_SPACE,
  FILE_IN_USE,
  FILE_OUTSIDE_FOLDER,
  HOST_TAKEN,
  INVALID_PUSH_SUBSCRIPTION,
  INVALID_REPEAT,
  OCCURRENCE_MISSING,
  OFFER_TERMS,
  OFFER_TRIAL_DAYS,
  OFFER_HAS_SUBSCRIPTIONS,
  OFFER_LINK_SELF,
  OFFER_LINK_SPACE,
  ONE_PRIMARY_DOMAIN,
  ORDER_EXTRAS,
  QUIZ_EMPTY,
  QUIZ_OPTION_LABEL,
  QUIZ_PASS_PERCENT,
  QUIZ_PROMPT,
  QUIZ_QUESTION_OPTIONS,
  REPORT_TARGET_MISSING,
  SESSION_OVERLAP,
  SLUG_RESERVED,
  SUBSCRIPTION_ID_TAKEN,
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
  parts_pass_percent: QUIZ_PASS_PERCENT,
  quiz_questions_prompt: QUIZ_PROMPT,
  quiz_options_label: QUIZ_OPTION_LABEL,
  // Raised by save_quiz_question and submit_quiz.
  quiz_question_options: QUIZ_QUESTION_OPTIONS,
  quiz_empty: QUIZ_EMPTY,
  // Studio checks the quiz first; this fires only on a race with a delete.
  modules_unlock_quiz_fk: 'quiz not found',
  products_certificates_program: CERTIFICATES_PROGRAM_ONLY,
  products_cover_path: FILE_OUTSIDE_FOLDER,
  space_branding_logo_path: FILE_OUTSIDE_FOLDER,
  space_branding_favicon_path: FILE_OUTSIDE_FOLDER,
  space_profiles_avatar_path: FILE_OUTSIDE_FOLDER,
  // Raised by issue_certificate.
  certificates_off: CERTIFICATES_OFF,
  certificate_not_earned: CERTIFICATE_NOT_EARNED,
  // Coupons, bumps, upsells (G23). The order FKs fire on delete: a used coupon / sold bump stays.
  offers_bump_space: OFFER_LINK_SPACE,
  offers_upsell_space: OFFER_LINK_SPACE,
  offers_bump_not_self: OFFER_LINK_SELF,
  offers_upsell_not_self: OFFER_LINK_SELF,
  coupons_code: COUPON_CODE,
  coupons_code_taken: COUPON_CODE_TAKEN,
  coupons_discount: COUPON_DISCOUNT,
  coupons_max_uses: COUPON_MAX_USES,
  coupon_offers_offer_space: COUPON_OFFER_SPACE,
  orders_coupon_space: COUPON_HAS_ORDERS,
  orders_bump_space: 'offer has orders',
  orders_extras: ORDER_EXTRAS,
  // Subscriptions and payment plans (G5). The subscription FK fires on offer delete.
  offers_kind: OFFER_TERMS,
  offers_billing_interval: OFFER_TERMS,
  offers_recurring_terms: OFFER_TERMS,
  offers_trial_days: OFFER_TRIAL_DAYS,
  subscriptions_offer_space: OFFER_HAS_SUBSCRIPTIONS,
  subscriptions_provider_id: SUBSCRIPTION_ID_TAKEN,
};

const TITLE_CHECK = /_title(_check)?$/;
const NAME = /constraint "([^"]+)"/;

/** Canonical text for the constraint named in a Postgres message, or null when unknown. */
export function constraintMessage(pgMessage: string): string | null {
  const name = NAME.exec(pgMessage)?.[1];
  if (!name) return null;
  return BY_NAME[name] ?? (TITLE_CHECK.test(name) ? 'title required' : null);
}
