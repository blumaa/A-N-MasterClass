// Quiz grading (G26). Same rules as submit_quiz in supabase/migrations/20261112150000_quizzes.sql:
// a question is right when the picked options are exactly its correct ones; score is the percent
// of questions right, rounded; no pass mark means every attempt passes.
export type GradedQuestion = { id: string; optionIds: readonly string[]; correctIds: readonly string[] };
export type Grade = { score: number; passed: boolean; correctQuestionIds: string[] };

export function gradeQuiz(questions: readonly GradedQuestion[], picked: readonly string[], passPercent: number | null): Grade {
  const chosen = new Set(picked);
  const correctQuestionIds = questions
    .filter((q) => {
      const key = new Set(q.correctIds);
      return q.optionIds.every((o) => chosen.has(o) === key.has(o));
    })
    .map((q) => q.id);
  const score = questions.length === 0 ? 0 : Math.round((100 * correctQuestionIds.length) / questions.length);
  return { score, passed: passPercent === null || score >= passPercent, correctQuestionIds };
}

/** Studio option rows (label per row, indexes of rows marked correct) -> options. Blank rows drop. */
export function quizOptionsOf(labels: readonly string[], correctRows: readonly string[]): { label: string; correct: boolean }[] {
  const correct = new Set(correctRows);
  return labels.flatMap((label, i) => (label.trim() ? [{ label: label.trim(), correct: correct.has(String(i)) }] : []));
}
