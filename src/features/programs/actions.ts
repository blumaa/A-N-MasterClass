'use server';
// Complete & Continue (G7). Auth + access re-checked here: Server Actions are public endpoints.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { getRepo } from '@/lib/data/getRepo';
import { completeStep, type CompleteResult } from './api/step';
import { stepHref } from './paths';

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
