// Data source SSOT. Only module that reads DATA_SOURCE.
// fake = in-memory repo + cookie dev login (no DB yet). supabase = real backend.

type Env = Record<string, string | undefined>;

export const DATA_SOURCES = ['fake', 'supabase'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export function readDataSource(env: Env): DataSource {
  const value = env.DATA_SOURCE;
  if (!DATA_SOURCES.includes(value as DataSource)) {
    throw new Error(`DATA_SOURCE must be one of ${DATA_SOURCES.join(', ')}; got ${JSON.stringify(value)}`);
  }
  return value as DataSource;
}

/** Dev login switcher: fake data only, never in production. */
export const devAuthAllowed = (env: Env): boolean =>
  readDataSource(env) === 'fake' && env.NODE_ENV !== 'production';

export const dataSource = (): DataSource => readDataSource(process.env);
