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
