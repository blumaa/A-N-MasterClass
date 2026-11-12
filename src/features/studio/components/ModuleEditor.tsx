// One module: settings (lock G7, quiz lock G26, drip G8), steps list, add step.
import { PublishStatusBadge } from '@/components/PublishStatusBadge/PublishStatusBadge';
import { Card, CardBody, Field, Heading, Input, Select, Stack, Text } from '@/components/ui/mds';
import { AppLink } from '@/components/ui/links';
import type { Part, Step } from '@/lib/data/types';
import type { CurriculumModule } from '../api/curriculum';
import { studioStepHref } from '../paths';
import { CommandForm } from './CommandForm';
import { MoveButtons } from './MoveButtons';
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';
import styles from './Curriculum.module.css';

type Props = {
  programSlug: string;
  mod: CurriculumModule;
  earlierSteps: Step[];
  /** Quiz parts of earlier modules, labelled for the lock select. */
  earlierQuizzes: { part: Part; label: string }[];
  first: boolean;
  last: boolean;
};

const dateInput = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');

export function ModuleEditor({ programSlug, mod, earlierSteps, earlierQuizzes, first, last }: Props) {
  return (
    <Card>
      <CardBody>
        <Stack gap="base">
          <div className={styles.head}>
            <Heading level={3} variant="subtitle">
              {mod.title}
            </Heading>
            <PublishStatusBadge status={mod.status} />
            <MoveButtons table="modules" id={mod.id} first={first} last={last} />
          </div>

          <details>
            <summary>Module settings</summary>
            <CommandForm fields={{ op: 'updateModule', moduleId: mod.id }} submit="Save module">
              <Field label="Title">
                <Input name="title" defaultValue={mod.title} required />
              </Field>
              <StatusSelect value={mod.status} />
              <Field label="Lock until lesson is complete">
                <Select name="unlockAfterStepId" defaultValue={mod.unlockAfterStepId ?? ''}>
                  <option value="">No lock</option>
                  {earlierSteps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lock until quiz is passed">
                <Select name="unlockQuizPartId" defaultValue={mod.unlockQuizPartId ?? ''}>
                  <option value="">No quiz lock</option>
                  {earlierQuizzes.map((q) => (
                    <option key={q.part.id} value={q.part.id}>
                      {q.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Release after days" hint="Days after the student joined. Blank = straight away.">
                <Input name="releaseAfterDays" type="number" min={0} defaultValue={mod.releaseAfterDays ?? ''} />
              </Field>
              <Field label="Release on date" hint="Fixed date for everyone. Blank = none.">
                <Input name="releaseAt" type="date" defaultValue={dateInput(mod.releaseAt)} />
              </Field>
            </CommandForm>
          </details>

          {mod.steps.length === 0 ? <Text tone="muted">No lessons yet.</Text> : null}
          <ol className={styles.rows}>
            {mod.steps.map((step, i) => (
              <li key={step.id} className={styles.row}>
                <AppLink href={studioStepHref(programSlug, step.id)}>{step.title}</AppLink>
                <PublishStatusBadge status={step.status} />
                <MoveButtons table="steps" id={step.id} first={i === 0} last={i === mod.steps.length - 1} />
              </li>
            ))}
          </ol>

          <div className={styles.actions}>
            <CommandForm inline fields={{ op: 'createStep', moduleId: mod.id }} submit="Add lesson">
              <Field label="New lesson title">
                <Input name="title" required />
              </Field>
            </CommandForm>
            <CommandForm
              inline
              variant="danger"
              fields={{ op: 'deleteModule', moduleId: mod.id }}
              submit="Delete module"
              confirm={`Delete "${mod.title}" with all its lessons and student progress?`}
            />
          </div>
        </Stack>
      </CardBody>
    </Card>
  );
}
