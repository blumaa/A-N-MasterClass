'use server';
// Dev sign-in (DATA_SOURCE=fake only; session.ts refuses otherwise).
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { startSession } from '@/lib/auth/session';
import { getRepo } from '@/lib/data/getRepo';
import { devSignInHref } from '@/lib/routes';
import { canSignInAs } from './api/devProfiles';

export async function devSignInAction(form: FormData): Promise<void> {
  const profileId = String(form.get('profileId') ?? '');
  const viewer = await actionViewer();
  if (!viewer || !(await canSignInAs(getRepo(), viewer.space, profileId))) redirect(`${devSignInHref}?error=1`);
  await startSession(profileId);
  redirect('/');
}
