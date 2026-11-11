// Custom host -> slug from space_domains, cached per process. Runs before any user is known:
// service repo. Shared by the proxy and Server Actions so both see one cache. Server only.
import 'server-only';
import { getServiceRepo } from '@/lib/data/getRepo';
import { createHostLookup } from './hostLookup';

// A newly attached domain is live within this long; a detached one stops within it too.
const HOST_CACHE_MS = 60_000;

export const findSpaceSlug = createHostLookup((host) => getServiceRepo().spaceSlugByHost(host), { ttlMs: HOST_CACHE_MS });
