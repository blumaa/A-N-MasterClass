// Viewer for Server Actions. Space comes from the request Host, never from action
// arguments: a client could send any slug, the host is what the session cookie is scoped to.
import 'server-only';
import { headers } from 'next/headers';
import { platformHost } from '@/config/platform';
import { resolveHost } from '@/lib/tenancy/resolveHost';
import { currentViewer } from './currentViewer';
import type { Viewer } from './viewer';

export async function actionViewer(): Promise<Viewer | null> {
  const resolution = resolveHost((await headers()).get('host'), platformHost());
  // Custom domains: slug from space_domains once the Supabase repo exists (phase 7).
  if (resolution.kind !== 'subdomain') return null;
  return currentViewer(resolution.slug);
}
