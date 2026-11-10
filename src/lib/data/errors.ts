// Data rule broken by user input (unique, check, FK). Supabase adapter maps Postgres
// 23505 / 23514 / 23503 to this. Anything else is a bug and must propagate.
export class ConstraintError extends Error {
  override name = 'ConstraintError';
}
