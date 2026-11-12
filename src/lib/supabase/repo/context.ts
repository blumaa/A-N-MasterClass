// Shared plumbing for the Supabase Repo modules.
// db(): the client the repo runs as (user session = RLS applies; service repo = secret key).
// admin(): secret-key client for the few methods that need it whatever the caller (auth admin API,
// secrets, token lookups). Kept out of every other method on purpose.
import type { Database } from '@/lib/db/database.types';
import type { Db } from '../server';
import { toDataError, type PgError } from '../dbError';

export type { Db };
export type RepoCtx = { db: () => Promise<Db>; admin: () => Db };
export type Tables = Database['public']['Tables'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];

type Result = { data: unknown; error: PgError | null };
type Data<R extends Result> = NonNullable<R['data']>;

/** Rows or throw the mapped error. Use where the query always returns data on success. */
export function unwrap<R extends Result>({ data, error }: R): Data<R> {
  if (error) throw toDataError(error);
  if (data === null) throw new Error('query returned no data');
  return data as Data<R>;
}

/** maybeSingle(): row, null when absent, or throw the mapped error. */
export function unwrapMaybe<R extends Result>({ data, error }: R): Data<R> | null {
  if (error) throw toDataError(error);
  return (data ?? null) as Data<R> | null;
}

/** Writes with no returned rows. */
export function check({ error }: { error: PgError | null }): void {
  if (error) throw toDataError(error);
}

export const toDate = (v: string): Date => new Date(v);
export const toDateOrNull = (v: string | null): Date | null => (v === null ? null : new Date(v));
export const isoOrNull = (v: Date | null | undefined): string | null | undefined =>
  v === undefined ? undefined : v === null ? null : v.toISOString();

/** Next position among siblings: max + 1, 0 when none (same as the fake repo). */
export async function nextPosition(
  db: Db,
  table: 'products' | 'modules' | 'steps' | 'parts' | 'channels' | 'post_photos',
  column: string,
  value: string,
): Promise<number> {
  const rows = unwrap(
    await db.from(table).select('position').eq(column, value).order('position', { ascending: false }).limit(1),
  ) as { position: number }[];
  return rows.length === 0 ? 0 : rows[0]!.position + 1;
}

/** Drop undefined keys so a patch only touches the fields it names. */
export function defined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}
