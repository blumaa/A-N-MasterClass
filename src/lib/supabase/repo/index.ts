// Supabase adapter for the Repo port: one module per domain, merged here.
// The type check below fails if any Repo method has no Supabase implementation.
import type { Repo } from '@/lib/data/repo';
import { createChatRepo } from './chat';
import { createCoachingRepo } from './coaching';
import { createCommerceRepo } from './commerce';
import { createCommunityRepo } from './community';
import type { RepoCtx } from './context';
import { createCoreRepo } from './core';
import { createEventsRepo } from './events';
import { createMediaRepo } from './media';
import { createModerationRepo } from './moderation';
import { createSiteRepo } from './site';

export type { RepoCtx };

export function createSupabaseRepo(ctx: RepoCtx): Repo {
  return {
    ...createCoreRepo(ctx),
    ...createSiteRepo(ctx),
    ...createCommerceRepo(ctx),
    ...createCommunityRepo(ctx),
    ...createChatRepo(ctx),
    ...createEventsRepo(ctx),
    ...createCoachingRepo(ctx),
    ...createMediaRepo(ctx),
    ...createModerationRepo(ctx),
  };
}
