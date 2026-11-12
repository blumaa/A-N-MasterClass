// Viewer for Server Actions. Space comes from the request host (requestHost), never from action
// arguments: a client could send any slug, the host is what the session cookie is scoped to.
import 'server-only';
import { headers } from 'next/headers';
import { platformHost } from '@/config/platform';
import { findSpaceSlug } from '@/lib/tenancy/findSpaceSlug';
import { requestHost } from '@/lib/tenancy/requestHost';
import { spaceSlugForHost } from '@/lib/tenancy/routeHost';
import { currentViewer } from './currentViewer';
import type { Viewer } from './viewer';

export async function actionViewer(): Promise<Viewer | null> {
  const slug = await spaceSlugForHost(requestHost(await headers()), platformHost(), findSpaceSlug);
  return slug ? currentViewer(slug) : null;
}
