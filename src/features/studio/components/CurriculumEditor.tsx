// Studio > Program: settings + module tree + add module.
import { Field, Heading, Input, Stack } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import type { Curriculum } from '../api/curriculum';
import { CommandForm } from './CommandForm';
import { ModuleEditor } from './ModuleEditor';
import { ProgramSettings } from './ProgramSettings';

export function CurriculumEditor({ curriculum, previewHref }: { curriculum: Curriculum; previewHref: string }) {
  const { program, modules } = curriculum;
  return (
    <Stack gap="loose">
      <div>
        <ButtonLink href={previewHref} variant="ghost">
          Preview as student
        </ButtonLink>
      </div>
      <ProgramSettings program={program} />
      <Heading level={2} variant="title">
        Curriculum
      </Heading>
      {modules.map((mod, i) => (
        <ModuleEditor
          key={mod.id}
          programSlug={program.slug}
          mod={mod}
          earlierSteps={modules.slice(0, i).flatMap((m) => m.steps)}
          first={i === 0}
          last={i === modules.length - 1}
        />
      ))}
      <CommandForm inline fields={{ op: 'createModule', programId: program.id }} submit="Add module" variant="primary">
        <Field label="New module title">
          <Input name="title" required />
        </Field>
      </CommandForm>
    </Stack>
  );
}
