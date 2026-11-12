// Quiz form fields (G26): one input group per question, named by question id. SSOT for the
// names QuizBlock renders and submitQuizAction reads.
const ANSWER_PREFIX = 'answer:';

export const answerField = (questionId: string): string => `${ANSWER_PREFIX}${questionId}`;

/** Every picked option id, across radio and checkbox groups. */
export function quizAnswersFromForm(form: FormData): string[] {
  return [...form.entries()].flatMap(([name, value]) =>
    name.startsWith(ANSWER_PREFIX) && typeof value === 'string' ? [value] : [],
  );
}
