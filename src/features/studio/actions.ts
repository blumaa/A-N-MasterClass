'use server';
// One Server Action for every curriculum form. Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { getRepo } from '@/lib/data/getRepo';
import { editCurriculum, type CommandResult } from './api/curriculum';
import { commandFromForm } from './commandFromForm';
import { studioProgramHref } from './paths';

export type EditState = { message: string } | null;

const MESSAGES: Record<Exclude<Extract<CommandResult, { ok: false }>['error'], 'invalid'>, string> = {
  forbidden: 'You do not have permission to edit programs.',
  not_found: 'Not found. It may have been deleted.',
};

export async function editCurriculumAction(_prev: EditState, form: FormData): Promise<EditState> {
  const parsed = commandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: MESSAGES.forbidden };

  const { command } = parsed;
  const result = await editCurriculum(getRepo(), viewer, command);
  if (!result.ok) return { message: result.error === 'invalid' ? result.message : MESSAGES[result.error] };
  if (command.op === 'createProgram') redirect(studioProgramHref(command.slug));
  const back = form.get('redirectTo');
  if (typeof back === 'string' && back.startsWith('/studio')) redirect(back);
  refresh();
  return null;
}
