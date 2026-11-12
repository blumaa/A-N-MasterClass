// Browser Supabase client (publishable key, session from auth cookies, RLS applies).
// Used only for Realtime; data reads stay on the server. @supabase/ssr keeps one per tab.
// Pattern: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createBrowserClient } from '@supabase/ssr';
import { supabasePublic } from '@/config/supabase';
import type { Database } from '@/lib/db/database.types';

export function browserClient() {
  const { url, publishableKey } = supabasePublic();
  return createBrowserClient<Database>(url, publishableKey);
}
