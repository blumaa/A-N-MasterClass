// Service-role client (secret key). Bypasses RLS: system paths only (webhooks, feeds, claim, host lookup). Server only.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabasePublic, supabaseSecret } from '@/config/supabase';
import type { Database } from '@/lib/db/database.types';
import type { Db } from './server';

const holder = globalThis as typeof globalThis & { __masterclassAdmin?: Db };

export function adminClient(): Db {
  holder.__masterclassAdmin ??= createClient<Database>(supabasePublic().url, supabaseSecret(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return holder.__masterclassAdmin;
}
