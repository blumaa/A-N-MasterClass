// Composition root: picks the Repo for DATA_SOURCE. Server only.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import type { Repo } from './repo';
import { createFakeRepo } from './fake/fakeRepo';
import { seedDb } from './fake/seed';
import { seedSite } from './fake/seedSite';

// globalThis keeps one fake DB across HMR reloads in dev.
const holder = globalThis as typeof globalThis & { __masterclassFakeRepo?: Repo };

export function getRepo(): Repo {
  switch (dataSource()) {
    case 'fake':
      holder.__masterclassFakeRepo ??= createFakeRepo(seedSite(seedDb()));
      return holder.__masterclassFakeRepo;
    case 'supabase':
      throw new Error('DATA_SOURCE=supabase: Supabase repo not built yet (Launch 1 phase 1 deferred). Use DATA_SOURCE=fake.');
  }
}
