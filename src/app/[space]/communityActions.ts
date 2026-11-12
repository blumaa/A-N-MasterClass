'use server';
// Member community writes (posts, comments on posts and lessons, reactions). Lives in app/
// because lesson comments need the programs StepGate and features never import each other.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { communityCommand } from '@/features/community/api/commands';
import { communityCommandFromForm } from '@/features/community/commandFromForm';
import { stepOpen } from '@/features/programs/api/step';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';

export type CommunityState = { message: string } | null;

const FORBIDDEN = 'You cannot do that here.';

export async function communityAction(_prev: CommunityState, form: FormData): Promise<CommunityState> {
  const parsed = communityCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer?.profile) return { message: 'Sign in to take part.' };

  const repo = getRepo();
  const now = new Date();
  const result = await communityCommand(repo, getFileStore('community'), viewer, parsed.command, now, (stepId) => stepOpen(repo, viewer, stepId, now));
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  // Deleting the post you are reading: go back to its community.
  const back = form.get('redirectTo');
  if (typeof back === 'string' && back.startsWith('/community/')) redirect(back);
  refresh();
  return null;
}
