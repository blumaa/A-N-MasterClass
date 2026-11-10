'use server';
// Dev sign-in/out (DATA_SOURCE=fake only; session.ts refuses otherwise).
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { endDevSession, startDevSession } from '@/lib/auth/session';
import { getRepo } from '@/lib/data/getRepo';
import { canSignInAs } from './api/devProfiles';

export async function devSignInAction(form: FormData): Promise<void> {
  const profileId = String(form.get('profileId') ?? '');
  const viewer = await actionViewer();
  if (!viewer || !(await canSignInAs(getRepo(), viewer.space, profileId))) redirect('/dev/login?error=1');
  await startDevSession(profileId);
  redirect('/');
}

export async function devSignOutAction(): Promise<void> {
  await endDevSession();
  redirect('/');
}
