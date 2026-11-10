'use server';
// Studio community forms + mark-all-read. Space from Host (actionViewer), never from the form.
// Member writes (posts, comments, reactions) need the programs StepGate and live in app/.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { markAllRead } from './api/notifications';
import { editCommunity } from './api/studio';
import { studioCommunityCommandFromForm } from './commandFromForm';
import { studioCommunityHref } from './paths';

export type EditState = { message: string } | null;

const FORBIDDEN = 'You do not have permission to edit communities.';

export async function editCommunityAction(_prev: EditState, form: FormData): Promise<EditState> {
  const parsed = studioCommunityCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: FORBIDDEN };

  const { command } = parsed;
  const result = await editCommunity(getRepo(), viewer, command);
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  if (command.op === 'createCommunity' && result.id) redirect(studioCommunityHref(result.id));
  refresh();
  return null;
}

export async function markAllReadAction(): Promise<EditState> {
  const viewer = await actionViewer();
  if (!viewer) return { message: 'Sign in to see notifications.' };
  await markAllRead(getRepo(), viewer, new Date());
  refresh();
  return null;
}
