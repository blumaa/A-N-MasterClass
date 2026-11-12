// Submit a quiz part of an open step (G26). Grading happens in the repo (submit_quiz on Supabase).
import type { Viewer } from '@/lib/auth/viewer';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { QuizAttempt } from '@/lib/data/types';
import { stepView } from './step';

export type SubmitQuizResult =
  | { ok: true; attempt: QuizAttempt }
  | { ok: false; error: 'signed_out' | 'not_found' | 'not_open' }
  | { ok: false; error: 'invalid'; message: string };

export async function submitQuiz(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  stepId: string,
  partId: string,
  optionIds: readonly string[],
  now: Date,
): Promise<SubmitQuizResult> {
  if (!viewer.profile) return { ok: false, error: 'signed_out' };
  const view = await stepView(repo, viewer, programSlug, stepId, now);
  if (!view) return { ok: false, error: 'not_found' };
  if (view.access.kind !== 'open') return { ok: false, error: 'not_open' };
  if (view.parts.find((p) => p.id === partId)?.kind !== 'quiz') return { ok: false, error: 'not_found' };
  try {
    return { ok: true, attempt: await repo.submitQuiz(partId, viewer.profile.id, optionIds) };
  } catch (error) {
    if (error instanceof ConstraintError) return { ok: false, error: 'invalid', message: error.message };
    throw error;
  }
}

const MESSAGES: Record<Exclude<SubmitQuizResult, { ok: true }>['error'], string> = {
  signed_out: 'Sign in to take the quiz.',
  not_found: 'This quiz no longer exists.',
  not_open: 'This lesson is not open yet.',
  invalid: 'This quiz cannot be submitted.',
};

/** What the member reads when a submit is refused. */
export function submitQuizMessage(result: Exclude<SubmitQuizResult, { ok: true }>): string {
  return result.error === 'invalid' ? result.message : MESSAGES[result.error];
}
