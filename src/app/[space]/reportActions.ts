'use server';
// Report writes: a member reports content; a moderator resolves a report. Space from Host
// (actionViewer), never from the form. Lives in app/ so report notifications go out as web push.
import { refresh } from 'next/cache';
import type { ActionState } from '@/components/ActionForm/ActionForm';
import { reportCommand } from '@/features/community/api/reports';
import { reportCommandFromForm } from '@/features/community/commandFromForm';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { drainSoon } from '@/lib/storage/cleanup';
import { pushingRepo } from './pushingRepo';

const FORBIDDEN = 'You cannot do that here.';

export async function reportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = reportCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer?.profile) return { message: 'Sign in to take part.' };
  const result = await reportCommand(pushingRepo(getRepo(), viewer.space), viewer, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  drainSoon();
  if (parsed.command.op === 'report') return { message: 'Thanks. The moderators will take a look.', ok: true };
  refresh();
  return null;
}
