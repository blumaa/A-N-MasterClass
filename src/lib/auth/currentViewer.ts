// Viewer for this request. Server only, deduped per request.
import 'server-only';
import { cache } from 'react';
import { getRepo } from '@/lib/data/getRepo';
import { sessionProfileId } from './session';
import { resolveViewer, type Viewer } from './viewer';

export const currentViewer = cache(
  async (spaceSlug: string): Promise<Viewer | null> => resolveViewer(getRepo(), spaceSlug, await sessionProfileId()),
);
