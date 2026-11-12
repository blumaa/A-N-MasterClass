'use server';
// One Server Action for every curriculum form. Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { drainSoon } from '@/lib/storage/cleanup';
import { editCurriculum } from './api/curriculum';
import { commandFromForm } from './commandFromForm';
import { studioProgramHref } from './paths';

export type EditState = { message: string } | null;

const FORBIDDEN = 'You do not have permission to edit programs.';

export async function editCurriculumAction(_prev: EditState, form: FormData): Promise<EditState> {
  const parsed = commandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: FORBIDDEN };

  const { command } = parsed;
  const result = await editCurriculum(getRepo(), viewer, command);
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  drainSoon();
  if (command.op === 'createProgram') redirect(studioProgramHref(command.slug));
  const back = form.get('redirectTo');
  if (typeof back === 'string' && back.startsWith('/studio')) redirect(back);
  refresh();
  return null;
}
