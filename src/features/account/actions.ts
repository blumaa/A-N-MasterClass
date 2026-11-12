'use server';
// Account Server Actions. Space and member from the session (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/components/ActionForm/ActionForm';
import { actionViewer } from '@/lib/auth/actionViewer';
import { endSession } from '@/lib/auth/session';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { deleteMyAccount } from './api/memberData';
import { saveMyProfile } from './api/profile';

const FORBIDDEN = 'Sign in to edit your profile.';

const text = (form: FormData, key: string): string => {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
};

export async function saveProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await actionViewer();
  if (!viewer) return { message: FORBIDDEN };
  const result = await saveMyProfile(getRepo(), viewer, {
    displayName: text(form, 'displayName'),
    bio: text(form, 'bio') || null,
    avatarPath: text(form, 'avatarPath') || null,
  });
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  refresh();
  return { message: 'Saved.', ok: true };
}

/** Deletes the member's data in this space (G25), then signs out: nothing is left to sign in to here. */
export async function deleteAccountAction(_prev: ActionState): Promise<ActionState> {
  const viewer = await actionViewer();
  if (!viewer) return { message: FORBIDDEN };
  const files = { site: getFileStore('site'), community: getFileStore('community') };
  const result = await deleteMyAccount(getRepo(), files, viewer);
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  await endSession();
  redirect('/');
}
