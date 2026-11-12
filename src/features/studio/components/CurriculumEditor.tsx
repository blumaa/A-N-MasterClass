// Studio > Program: settings + module tree + add module.
import { Field, Heading, Input, Stack } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import type { ImageSrc } from '@/components/ProductFields/ProductFields';
import type { Curriculum, CurriculumModule } from '../api/curriculum';
import { CommandForm } from './CommandForm';
import { ModuleEditor } from './ModuleEditor';
import { ProgramSettings } from './ProgramSettings';

const quizzesOf = (modules: CurriculumModule[]) =>
  modules.flatMap((m) =>
    m.steps.flatMap((s) => s.parts.filter((p) => p.kind === 'quiz').map((part) => ({ part, label: `${s.title}: ${part.title ?? 'Quiz'}` }))),
  );

type Props = { curriculum: Curriculum; previewHref: string; imageSrc: ImageSrc };

export function CurriculumEditor({ curriculum, previewHref, imageSrc }: Props) {
  const { program, modules } = curriculum;
  return (
    <Stack gap="loose">
      <div>
        <ButtonLink href={previewHref} variant="ghost">
          Preview as student
        </ButtonLink>
      </div>
      <ProgramSettings program={program} imageSrc={imageSrc} />
      <Heading level={2} variant="title">
        Curriculum
      </Heading>
      {modules.map((mod, i) => (
        <ModuleEditor
          key={mod.id}
          programSlug={program.slug}
          mod={mod}
          earlierSteps={modules.slice(0, i).flatMap((m) => m.steps)}
          earlierQuizzes={quizzesOf(modules.slice(0, i))}
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
