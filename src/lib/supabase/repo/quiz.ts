// Supabase Repo: quizzes (G26). Semantics mirror src/lib/data/fake/fakeQuizRepo.ts;
// rules live in 20261112150000_quizzes.sql (RLS hides quiz_keys from members).
import type { Repo } from '@/lib/data/repo';
import type { QuizAttempt, QuizQuestion } from '@/lib/data/types';
import { check, toDate, unwrap, unwrapMaybe, type RepoCtx, type Row } from './context';

export type QuizRepo = Pick<
  Repo,
  'quizQuestions' | 'quizQuestion' | 'quizKey' | 'saveQuizQuestion' | 'deleteQuizQuestion' | 'submitQuiz' | 'quizAttempts'
>;

const QUESTION_COLUMNS = 'id, part_id, prompt, position, multiple, quiz_options(id, label, position)';
type QuestionRow = Pick<Row<'quiz_questions'>, 'id' | 'part_id' | 'prompt' | 'position' | 'multiple'> & {
  quiz_options: Pick<Row<'quiz_options'>, 'id' | 'label' | 'position'>[];
};

const toQuestion = (r: QuestionRow): QuizQuestion => ({
  id: r.id,
  partId: r.part_id,
  prompt: r.prompt,
  position: r.position,
  multiple: r.multiple,
  options: r.quiz_options.toSorted((a, b) => a.position - b.position).map((o) => ({ id: o.id, label: o.label })),
});

export const toAttempt = (r: Row<'quiz_attempts'>): QuizAttempt => ({
  id: r.id,
  partId: r.part_id,
  profileId: r.profile_id,
  score: r.score,
  passed: r.passed,
  correctQuestionIds: r.correct_question_ids,
  createdAt: toDate(r.created_at),
});

// Everything runs as the caller: RLS decides who reads questions, keys and attempts.
export function createQuizRepo({ db }: RepoCtx): QuizRepo {
  return {
    async quizQuestions(partIds) {
      if (partIds.length === 0) return [];
      const rows = unwrap(
        await (await db()).from('quiz_questions').select(QUESTION_COLUMNS).in('part_id', [...partIds]).order('position'),
      );
      const order = new Map(partIds.map((p, i) => [p, i]));
      return rows.toSorted((a, b) => order.get(a.part_id)! - order.get(b.part_id)!).map(toQuestion);
    },
    async quizQuestion(id) {
      const row = unwrapMaybe(await (await db()).from('quiz_questions').select(QUESTION_COLUMNS).eq('id', id).maybeSingle());
      return row && toQuestion(row);
    },
    async quizKey(partIds) {
      if (partIds.length === 0) return new Set();
      const rows = unwrap(
        await (await db())
          .from('quiz_keys')
          .select('option_id, quiz_options!inner(quiz_questions!inner(part_id))')
          .in('quiz_options.quiz_questions.part_id', [...partIds]),
      );
      return new Set(rows.map((r) => r.option_id));
    },
    async saveQuizQuestion({ partId, questionId, prompt, options }) {
      return unwrap(
        await (await db()).rpc('save_quiz_question', {
          target_part: partId,
          // The SQL arg takes null for a new question; generated types mark every arg non-null.
          target_question: questionId as string,
          question_prompt: prompt,
          option_labels: options.map((o) => o.label),
          option_correct: options.map((o) => o.correct),
        }),
      );
    },
    async deleteQuizQuestion(id) {
      check(await (await db()).from('quiz_questions').delete().eq('id', id));
    },
    async submitQuiz(partId, _profileId, optionIds) {
      const row = unwrap(await (await db()).rpc('submit_quiz', { target_part: partId, picked: [...optionIds] }));
      return toAttempt(row);
    },
    async quizAttempts(profileId, partIds) {
      if (partIds.length === 0) return [];
      const rows = unwrap(
        await (await db())
          .from('quiz_attempts')
          .select('*')
          .eq('profile_id', profileId)
          .in('part_id', [...partIds])
          .order('created_at', { ascending: false }),
      );
      return rows.map(toAttempt);
    },
  };
}
