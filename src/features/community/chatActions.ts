'use server';
// Member chat writes: channel messages, DMs, blocks. Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { chatCommand } from './api/chat';
import { chatCommandFromForm } from './commandFromForm';
import { dmHref } from './paths';

export type ChatState = { message: string } | null;

const FORBIDDEN = 'You cannot do that here.';

export async function chatAction(_prev: ChatState, form: FormData): Promise<ChatState> {
  const parsed = chatCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer?.profile) return { message: 'Sign in to take part.' };

  const repo = getRepo();
  const { command } = parsed;
  const result = await chatCommand(repo, getFileStore('community'), viewer, command, new Date());
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  if (command.op === 'startDm' && result.id) {
    // Slug from the stored community, never from the form.
    const community = await repo.product(command.communityId);
    if (community) redirect(dmHref(community.slug, result.id));
  }
  refresh();
  return null;
}
