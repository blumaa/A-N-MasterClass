// Quiz parts of an open step for the member (G26): questions and options, never the answer key.
import type { Repo } from '@/lib/data/repo';
import type { Part, QuizAttempt, QuizQuestion } from '@/lib/data/types';

export type QuizView = { questions: QuizQuestion[]; latest: QuizAttempt | null };

/** Questions + latest attempt per quiz part. Call only for parts of an open step. */
export async function quizViews(repo: Repo, profileId: string | null, parts: Part[]): Promise<Record<string, QuizView>> {
  const ids = parts.filter((p) => p.kind === 'quiz').map((p) => p.id);
  if (ids.length === 0) return {};
  const [questions, attempts] = await Promise.all([
    repo.quizQuestions(ids),
    profileId ? repo.quizAttempts(profileId, ids) : [],
  ]);
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { questions: questions.filter((q) => q.partId === id), latest: attempts.find((a) => a.partId === id) ?? null },
    ]),
  );
}
