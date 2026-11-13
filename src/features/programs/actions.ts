'use server';
// Complete & Continue (G7), quiz submit and certificate share link (G26). Auth + access re-checked here: Server Actions
// are public endpoints.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/components/ActionForm/ActionForm';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { formReader } from '@/lib/forms/formReader';
import { shareCertificate } from './api/certificateShare';
import { completeStep, type CompleteResult } from './api/step';
import { submitQuiz, submitQuizMessage } from './api/quiz';
import { stepHref } from './paths';
import { quizAnswersFromForm } from './quizFromForm';

export type CompleteState = Extract<CompleteResult, { ok: false }> | null;

export async function completeStepAction(_prev: CompleteState, form: FormData): Promise<CompleteState> {
  const program = String(form.get('program') ?? '');
  const step = String(form.get('step') ?? '');
  const done = form.get('done') === 'true';
  const viewer = await actionViewer();
  if (!viewer) return { ok: false, error: 'signed_out' };

  const result = await completeStep(getRepo(), viewer, program, step, done, new Date());
  if (!result.ok) return result;
  // Kajabi: ticking moves on to the next lesson; un-ticking stays.
  if (done && result.nextStepId) redirect(stepHref(program, result.nextStepId));
  refresh();
  return null;
}

/** Grades on the server; the refreshed page shows the result from the stored attempt. */
export async function submitQuizAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await actionViewer();
  if (!viewer) return { message: submitQuizMessage({ ok: false, error: 'signed_out' }) };
  const result = await submitQuiz(
    getRepo(),
    viewer,
    String(form.get('program') ?? ''),
    String(form.get('step') ?? ''),
    String(form.get('part') ?? ''),
    quizAnswersFromForm(form),
    new Date(),
  );
  if (!result.ok) return { message: submitQuizMessage(result) };
  refresh();
  return null;
}

const SIGN_IN_TO_SHARE = 'Sign in to share your certificate.';

/** Turns the viewer's public certificate link on (`shared=true`) or off. */
export async function shareCertificateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const read = formReader(form);
  const program = read.raw('program');
  if (!program) return { message: 'Missing program.' };
  const viewer = await actionViewer();
  if (!viewer) return { message: SIGN_IN_TO_SHARE };
  const result = await shareCertificate(getRepo(), viewer, program, read.raw('shared') === 'true', new Date());
  if (!result.ok) return { message: failureMessage(result, SIGN_IN_TO_SHARE) };
  refresh();
  return null;
}
