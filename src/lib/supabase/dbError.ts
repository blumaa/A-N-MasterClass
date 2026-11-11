// Postgres error -> data-layer error. Class 23 (integrity constraint violation) is user input
// breaking a data rule: ConstraintError, shown to the user. Anything else is a bug and propagates.
// Codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
import { ConstraintError } from '@/lib/data/errors';

export type PgError = { code: string; message: string; details?: string | null; hint?: string | null };

export function toDataError(error: PgError): Error {
  if (error.code.startsWith('23')) return new ConstraintError(error.message);
  return new Error(`[${error.code}] ${error.message}${error.details ? ` (${error.details})` : ''}`);
}
