// Supabase settings SSOT. Only module that reads the Supabase env vars.
// Publishable key = browser-safe, RLS applies. Secret key = server only, bypasses RLS.

type Env = Record<string, string | undefined>;

export type SupabasePublic = { url: string; publishableKey: string };

export function readSupabasePublic(env: Env): SupabasePublic {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  if (!url.startsWith('https://')) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL must be an https URL; got ${JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL)}`);
  }
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!publishableKey) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
  return { url, publishableKey };
}

export function readSupabaseSecret(env: Env): string {
  const key = env.SUPABASE_SECRET_KEY?.trim() ?? '';
  if (!key.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY must be a secret key (sb_secret_...)');
  return key;
}

// NEXT_PUBLIC_* must be read by literal name so Next inlines them into browser bundles.
export const supabasePublic = (): SupabasePublic =>
  readSupabasePublic({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

export const supabaseSecret = (): string => readSupabaseSecret(process.env);
