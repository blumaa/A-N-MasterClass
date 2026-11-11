// Platform pages: signed out -> sign in; signed in without the platform admin flag -> 404.
import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { platformSignInHref } from '@/features/platform/paths';
import { currentPlatformAdmin } from '@/lib/auth/currentViewer';
import { sessionProfileId } from '@/lib/auth/session';
import type { Profile } from '@/lib/data/types';

export async function requirePlatformAdmin(): Promise<Profile> {
  if (!(await sessionProfileId())) redirect(platformSignInHref);
  const admin = await currentPlatformAdmin();
  if (!admin) notFound();
  return admin;
}
