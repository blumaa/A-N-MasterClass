// Body length limits shared by both repos and the UI. SQL checks hold the same numbers
// (supabase/migrations: posts_body_check, comments_body_check, messages, challenge_entries_body).
export const POST_MAX = 10_000;
export const COMMENT_MAX = 5_000;
export const MESSAGE_MAX = 4_000;
export const ENTRY_MAX = 5_000;

export const bodyRangeMessage = (max: number): string => `body must be 1..${max} chars`;

/** Optional report reason. SQL: reports_reason. */
export const REPORT_REASON_MAX = 500;
export const REPORT_REASON_RANGE = `reason must be 1..${REPORT_REASON_MAX} chars`;
