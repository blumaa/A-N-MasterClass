// Quiz part of the fake repo. Same rules as supabase/migrations/20261112150000_quizzes.sql
// (save_quiz_question, submit_quiz, prompt/label checks). Access is checked by the features
// (stepAccess), as RLS does in Postgres.
import { gradeQuiz } from '@/lib/programs/quiz';
import { ConstraintError, QUIZ_EMPTY, QUIZ_OPTION_LABEL, QUIZ_PROMPT, QUIZ_QUESTION_OPTIONS } from '../errors';
import type { Repo } from '../repo';
import type { QuizAttempt, QuizQuestion } from '../types';
import type { Db } from './db';

type QuizRepo = Pick<
  Repo,
  'quizQuestions' | 'quizQuestion' | 'quizKey' | 'saveQuizQuestion' | 'deleteQuizQuestion' | 'submitQuiz' | 'quizAttempts'
>;

export type FakeQuizQuestion = Omit<QuizQuestion, 'options'>;
export type FakeQuizOption = { id: string; questionId: string; label: string; position: number; correct: boolean };

const PROMPT_MAX = 1000;
const LABEL_MAX = 500;
const byPosition = <T extends { position: number }>(rows: T[]): T[] => rows.toSorted((a, b) => a.position - b.position);

/** Cascade: drop quiz rows of these parts and clear module locks on them (SQL: FKs). */
export function removeQuizParts(db: Db, partIds: ReadonlySet<string>): void {
  const questions = new Set(db.quizQuestions.filter((q) => partIds.has(q.partId)).map((q) => q.id));
  db.quizOptions = db.quizOptions.filter((o) => !questions.has(o.questionId));
  db.quizQuestions = db.quizQuestions.filter((q) => !questions.has(q.id));
  db.quizAttempts = db.quizAttempts.filter((a) => !partIds.has(a.partId));
  for (const m of db.modules) {
    if (m.unlockQuizPartId && partIds.has(m.unlockQuizPartId)) m.unlockQuizPartId = null;
  }
}

export function createFakeQuizRepo(db: Db, id: (prefix: string) => string): QuizRepo {
  const optionsOf = (questionId: string) => byPosition(db.quizOptions.filter((o) => o.questionId === questionId));
  const withOptions = (q: FakeQuizQuestion): QuizQuestion => ({
    ...q,
    options: optionsOf(q.id).map((o) => ({ id: o.id, label: o.label })),
  });

  return {
    async quizQuestions(partIds) {
      const order = new Map(partIds.map((p, i) => [p, i]));
      return db.quizQuestions
        .filter((q) => order.has(q.partId))
        .toSorted((a, b) => order.get(a.partId)! - order.get(b.partId)! || a.position - b.position)
        .map(withOptions);
    },
    async quizQuestion(qid) {
      const q = db.quizQuestions.find((row) => row.id === qid);
      return q ? withOptions(q) : null;
    },
    async quizKey(partIds) {
      const parts = new Set(partIds);
      const questions = new Set(db.quizQuestions.filter((q) => parts.has(q.partId)).map((q) => q.id));
      return new Set(db.quizOptions.filter((o) => o.correct && questions.has(o.questionId)).map((o) => o.id));
    },
    async saveQuizQuestion({ partId, questionId, prompt, options }) {
      if (options.length < 2 || !options.some((o) => o.correct)) throw new ConstraintError(QUIZ_QUESTION_OPTIONS);
      if (db.parts.find((p) => p.id === partId)?.kind !== 'quiz') throw new Error('quiz not found');
      if (!prompt.trim() || prompt.length > PROMPT_MAX) throw new ConstraintError(QUIZ_PROMPT);
      if (options.some((o) => !o.label.trim() || o.label.length > LABEL_MAX)) throw new ConstraintError(QUIZ_OPTION_LABEL);
      const multiple = options.filter((o) => o.correct).length > 1;
      let qid = questionId;
      if (qid === null) {
        const siblings = db.quizQuestions.filter((q) => q.partId === partId);
        const position = siblings.reduce((max, q) => Math.max(max, q.position + 1), 0);
        qid = id('question');
        db.quizQuestions.push({ id: qid, partId, prompt, position, multiple });
      } else {
        const row = db.quizQuestions.find((q) => q.id === qid && q.partId === partId);
        if (!row) throw new Error('question not found');
        Object.assign(row, { prompt, multiple });
        db.quizOptions = db.quizOptions.filter((o) => o.questionId !== qid);
      }
      const saved = qid;
      db.quizOptions.push(...options.map((o, i) => ({ id: id('option'), questionId: saved, label: o.label, position: i, correct: o.correct })));
      return saved;
    },
    async deleteQuizQuestion(qid) {
      db.quizOptions = db.quizOptions.filter((o) => o.questionId !== qid);
      db.quizQuestions = db.quizQuestions.filter((q) => q.id !== qid);
    },
    async submitQuiz(partId, profileId, optionIds) {
      const part = db.parts.find((p) => p.id === partId);
      if (part?.kind !== 'quiz') throw new Error('quiz not open');
      const questions = db.quizQuestions.filter((q) => q.partId === partId).toSorted((a, b) => a.position - b.position);
      if (questions.length === 0) throw new ConstraintError(QUIZ_EMPTY);
      const graded = questions.map((q) => {
        const options = optionsOf(q.id);
        return { id: q.id, optionIds: options.map((o) => o.id), correctIds: options.filter((o) => o.correct).map((o) => o.id) };
      });
      const row: QuizAttempt = {
        id: id('attempt'),
        partId,
        profileId,
        ...gradeQuiz(graded, optionIds, part.passPercent),
        createdAt: new Date(),
      };
      db.quizAttempts.push(row);
      return row;
    },
    async quizAttempts(profileId, partIds) {
      const parts = new Set(partIds);
      return db.quizAttempts
        .filter((a) => a.profileId === profileId && parts.has(a.partId))
        .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
}
