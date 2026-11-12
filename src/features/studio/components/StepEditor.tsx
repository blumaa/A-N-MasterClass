// Studio > Lesson: title, description, status, content blocks.
import { Field, Heading, Input, Select, Stack, Textarea } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { PART_KINDS } from '@/lib/data/types';
import type { CurriculumStep } from '../api/curriculum';
import { studioProgramHref } from '../paths';
import { CommandForm } from './CommandForm';
import { PartEditor } from './PartEditor';
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';

type Props = { programId: string; programSlug: string; step: CurriculumStep; previewHref: string };

export function StepEditor({ programId, programSlug, step, previewHref }: Props) {
  const back = studioProgramHref(programSlug);
  return (
    <Stack gap="loose">
      <div>
        <ButtonLink href={back} variant="ghost">
          Back to curriculum
        </ButtonLink>{' '}
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
        <PartEditor key={part.id} programId={programId} part={part} first={i === 0} last={i === step.parts.length - 1} />
      ))}
      <CommandForm inline fields={{ op: 'createPart', stepId: step.id }} submit="Add block" variant="primary">
        <Field label="Block type">
          <Select name="kind" defaultValue="text">
            {PART_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
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
