// Per-request Supabase client acting as the signed-in user (publishable key, RLS applies). Server only.
// Pattern: https://supabase.com/docs/guides/auth/server-side/nextjs
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { supabasePublic } from '@/config/supabase';
import type { Database } from '@/lib/db/database.types';

export type Db = SupabaseClient<Database>;

export const userClient = cache(async (): Promise<Db> => {
  const { url, publishableKey } = supabasePublic();
  const store = await cookies();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        // Server Components cannot write cookies; the proxy refreshes the session instead (documented pattern).
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {}
      },
    },
  });
});
