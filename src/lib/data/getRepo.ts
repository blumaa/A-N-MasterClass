// Composition root: picks the Repo for DATA_SOURCE. Server only.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import type { Repo } from './repo';
import { createFakeRepo } from './fake/fakeRepo';
import { seedDb } from './fake/seed';
import { seedSite } from './fake/seedSite';
import { adminClient } from '@/lib/supabase/admin';
import { createSupabaseRepo } from '@/lib/supabase/repo';
import { userClient } from '@/lib/supabase/server';

// globalThis keeps one fake DB across HMR reloads in dev.
const holder = globalThis as typeof globalThis & { __masterclassFakeRepo?: Repo };

/** Repo as the signed-in user (RLS applies). Default for pages, actions and route handlers. */
export function getRepo(): Repo {
  switch (dataSource()) {
    case 'fake':
      holder.__masterclassFakeRepo ??= createFakeRepo(seedSite(seedDb()));
      return holder.__masterclassFakeRepo;
    case 'supabase':
      return createSupabaseRepo({ db: userClient, admin: adminClient });
  }
}

/**
 * Repo with the secret key (bypasses RLS). Only for system paths with no user session:
 * proxy host lookup, payment webhooks, podcast feeds, guest checkout fulfil, claim, OAuth callbacks.
 */
export function getServiceRepo(): Repo {
  switch (dataSource()) {
    case 'fake':
      return getRepo();
    case 'supabase':
      return createSupabaseRepo({ db: async () => adminClient(), admin: adminClient });
  }
}
