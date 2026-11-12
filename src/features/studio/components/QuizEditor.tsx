// Studio quiz questions (G26): one form per question plus an add form. Each form posts the prompt,
// fixed answer rows (blank rows drop) and ticked `correct` boxes carrying their row index.
// More than one correct answer makes the question a checkbox question.
import { Card, CardBody, Checkbox, Field, Input, Stack, Text } from '@/components/ui/mds';
import type { EditorQuestion } from '../api/curriculum';
import { CommandForm } from './CommandForm';
import styles from './Curriculum.module.css';

const ROWS = 6;

function AnswerRows({ options }: { options: EditorQuestion['options'] }) {
  const count = Math.max(ROWS, options.length);
  return (
    <Stack gap="tight">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.answer}>
          <Field label={`Answer ${i + 1}`}>
            <Input name="option" defaultValue={options[i]?.label ?? ''} />
          </Field>
          <Checkbox name="correct" value={String(i)} label="Correct" defaultChecked={options[i]?.correct ?? false} />
        </div>
      ))}
    </Stack>
  );
}

function QuestionForm({ partId, question }: { partId: string; question: EditorQuestion | null }) {
  return (
    <CommandForm
      fields={{ op: 'saveQuestion', partId, questionId: question?.id ?? '' }}
      submit={question ? 'Save question' : 'Add question'}
      variant={question ? 'secondary' : 'primary'}
    >
      <Field label="Question">
        <Input name="prompt" defaultValue={question?.prompt ?? ''} required />
      </Field>
      <AnswerRows options={question?.options ?? []} />
    </CommandForm>
  );
}

export function QuizEditor({ partId, questions }: { partId: string; questions: EditorQuestion[] }) {
  return (
    <Stack gap="base">
      <Text tone="muted" variant="note">
        Tick every correct answer. Two or more correct answers show as checkboxes.
      </Text>
      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardBody>
            <Stack gap="tight">
              <Text variant="label">Question {i + 1}</Text>
              <QuestionForm partId={partId} question={q} />
              <CommandForm
                inline
                variant="ghost"
                fields={{ op: 'deleteQuestion', questionId: q.id }}
                submit="Delete question"
                confirm="Delete this question?"
              />
            </Stack>
          </CardBody>
        </Card>
      ))}
      <details>
        <summary>Add a question</summary>
        <QuestionForm partId={partId} question={null} />
      </details>
    </Stack>
  );
}
