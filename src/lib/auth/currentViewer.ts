// Viewer (and platform admin) for this request. Server only, deduped per request.
import 'server-only';
import { cache } from 'react';
import { getRepo, getServiceRepo } from '@/lib/data/getRepo';
import type { Profile } from '@/lib/data/types';
import { asPlatformAdmin } from './platformAdmin';
import { sessionProfileId } from './session';
import { resolveViewer, type Viewer } from './viewer';

/**
 * Service repo: RLS hides draft spaces from anonymous visitors, so the owner of a new draft space
 * could not reach its login or claim page. The profile id comes from the verified session, and
 * draft-space pages are gated by canSeeSpace. Page data still goes through getRepo (RLS).
 */
export const currentViewer = cache(
  async (spaceSlug: string): Promise<Viewer | null> => resolveViewer(getServiceRepo(), spaceSlug, await sessionProfileId()),
);

/** Signed-in platform admin on the platform host, else null. */
export const currentPlatformAdmin = cache(async (): Promise<Profile | null> => asPlatformAdmin(getRepo(), await sessionProfileId()));
