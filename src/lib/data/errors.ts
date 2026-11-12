// Data rule broken by user input (unique, check, FK). Supabase adapter maps Postgres
// 23505 / 23514 / 23503 to this. Anything else is a bug and must propagate.
export class ConstraintError extends Error {
  override name = 'ConstraintError';
}

/** Two scheduled coaching sessions of a space overlap (exclusion constraint). Features match on it. */
export const SESSION_OVERLAP = 'overlaps another session';

// Tenancy constraint texts, shared by the fake repo and constraintMessages (platform admin).
export const SLUG_RESERVED = 'slug reserved';
export const HOST_TAKEN = 'host taken';
export const ONE_PRIMARY_DOMAIN = 'space already has a primary domain';
export const ALREADY_MEMBER = 'already a member';

// Report texts, shared by the fake repo and constraintMessages (moderation).
export const ALREADY_REPORTED = 'already reported';
export const REPORT_TARGET_MISSING = 'content not found';

// Community file texts (post photos, chat attachments), shared by the fake repo and constraintMessages.
export const FILE_OUTSIDE_FOLDER = 'file is outside its folder';
export const FILE_IN_USE = 'file already used';
export const TOO_MANY_PHOTOS = 'too many photos on this post';
export const ATTACHMENT_INCOMPLETE = 'attachment needs a name, type and size';

// Push subscription text, shared by the fake repo and constraintMessages.
export const INVALID_PUSH_SUBSCRIPTION = 'invalid push subscription';

// Recurring meetup texts, shared by the fake repo and constraintMessages.
export const INVALID_REPEAT = 'invalid repeat';
export const OCCURRENCE_MISSING = 'no such occurrence';

// Quiz texts (G26), shared by the fake repo and constraintMessages.
export const QUIZ_QUESTION_OPTIONS = 'a question needs two answers and one correct answer';
export const QUIZ_PROMPT = 'question required';
export const QUIZ_OPTION_LABEL = 'answer required';
export const QUIZ_EMPTY = 'quiz has no questions';
export const QUIZ_PASS_PERCENT = 'pass mark must be 1 to 100';

// Certificate texts (G26), shared by the fake repo and constraintMessages.
export const CERTIFICATES_OFF = 'certificates are off for this program';
export const CERTIFICATE_NOT_EARNED = 'finish every step to earn the certificate';
export const CERTIFICATES_PROGRAM_ONLY = 'only programs give certificates';
