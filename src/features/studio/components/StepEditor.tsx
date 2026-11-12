// Studio > Lesson: title, description, status, content blocks.
import { Field, Heading, Input, Stack, Textarea } from '@/components/ui/mds';
import { BackLink, ButtonLink } from '@/components/ui/links';
import { ChoiceSelect } from '@/components/fields/fields';
import { PART_KINDS } from '@/lib/data/types';
import { PART_KIND_LABELS } from '../partKinds';
import type { CurriculumStep, EditorQuestion } from '../api/curriculum';
import { studioProgramHref } from '../paths';
import { CommandForm } from './CommandForm';
import { PartEditor } from './PartEditor';
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';

type Props = {
  programId: string;
  programSlug: string;
  step: CurriculumStep;
  previewHref: string;
  quizzes: Record<string, EditorQuestion[]>;
};

export function StepEditor({ programId, programSlug, step, previewHref, quizzes }: Props) {
  const back = studioProgramHref(programSlug);
  return (
    <Stack gap="loose">
      <div>
        <BackLink href={back}>curriculum</BackLink>{' '}
        <ButtonLink href={previewHref} variant="ghost">
          Preview as student
        </ButtonLink>
      </div>
      <CommandForm fields={{ op: 'updateStep', stepId: step.id }} submit="Save lesson">
        <Field label="Title">
          <Input name="title" defaultValue={step.title} required />
        </Field>
        <Field label="Description">
          <Textarea name="description" rows={3} defaultValue={step.description ?? ''} />
        </Field>
        <StatusSelect value={step.status} />
      </CommandForm>

      <Heading level={2} variant="title">
        Content
      </Heading>
      {step.parts.map((part, i) => (
        <PartEditor
          key={part.id}
          programId={programId}
          part={part}
          first={i === 0}
          last={i === step.parts.length - 1}
          questions={quizzes[part.id]}
        />
      ))}
      <CommandForm inline fields={{ op: 'createPart', stepId: step.id }} submit="Add block" variant="primary">
        <ChoiceSelect name="kind" label="Block type" value="text" options={PART_KINDS} labels={PART_KIND_LABELS} />
      </CommandForm>

      <CommandForm
        inline
        variant="danger"
        fields={{ op: 'deleteStep', stepId: step.id, redirectTo: back }}
        submit="Delete lesson"
        confirm={`Delete "${step.title}" and its student progress?`}
      />
    </Stack>
  );
}
