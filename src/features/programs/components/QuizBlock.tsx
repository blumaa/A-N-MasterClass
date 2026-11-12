// Quiz part (G26). Questions only: the answer key never reaches the page. Grading happens in
// submitQuizAction; the latest stored attempt shows the score and which questions were right.
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { Badge, Checkbox, Radio, Stack, Text } from '@/components/ui/mds';
import type { QuizAttempt, QuizQuestion } from '@/lib/data/types';
import { submitQuizAction } from '../actions';
import type { QuizView } from '../api/quizView';
import { answerField } from '../quizFromForm';
import styles from './QuizBlock.module.css';

type Props = { quiz: QuizView; passPercent: number | null; programSlug: string; stepId: string; partId: string };

function Result({ latest, passPercent }: { latest: QuizAttempt; passPercent: number | null }) {
  return (
    <div role="status" className={styles.result}>
      <Text variant="label">Your score: {latest.score}%</Text>
      {passPercent ? (
        <Badge tone={latest.passed ? 'success' : 'danger'}>{latest.passed ? 'Passed' : 'Not passed'}</Badge>
      ) : null}
      {passPercent ? (
        <Text tone="muted" variant="note">
          Pass mark: {passPercent}%
        </Text>
      ) : null}
    </div>
  );
}

function Question({ question, latest }: { question: QuizQuestion; latest: QuizAttempt | null }) {
  const Input = question.multiple ? Checkbox : Radio;
  const right = latest?.correctQuestionIds.includes(question.id);
  return (
    <fieldset className={styles.question}>
      <legend className={styles.prompt}>{question.prompt}</legend>
      {latest ? (
        <Badge tone={right ? 'success' : 'danger'}>{right ? 'Correct' : 'Incorrect'}</Badge>
      ) : null}
      {question.multiple ? (
        <Text tone="muted" variant="note">
          Select all that apply.
        </Text>
      ) : null}
      <Stack gap="tight">
        {question.options.map((option) => (
          <Input key={option.id} name={answerField(question.id)} value={option.id} label={option.label} />
        ))}
      </Stack>
    </fieldset>
  );
}

export function QuizBlock({ quiz, passPercent, programSlug, stepId, partId }: Props) {
  if (quiz.questions.length === 0) {
    return <Text tone="muted">This quiz has no questions yet.</Text>;
  }
  return (
    <Stack gap="base">
      {quiz.latest ? <Result latest={quiz.latest} passPercent={passPercent} /> : null}
      <ActionForm
        action={submitQuizAction}
        fields={{ program: programSlug, step: stepId, part: partId }}
        submit={quiz.latest ? 'Retake quiz' : 'Submit answers'}
        variant="primary"
      >
        {quiz.questions.map((question) => (
          <Question key={question.id} question={question} latest={quiz.latest} />
        ))}
      </ActionForm>
    </Stack>
  );
}
