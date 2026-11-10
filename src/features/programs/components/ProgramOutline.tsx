// Sidebar/program-page outline: modules, steps, checkmarks, lock/drip labels, progress (G6–G8).
import { Badge, Heading, ProgressBar, Stack, Text } from '@/components/ui/mds';
import { AppLink } from '@/components/ui/links';
import type { Outline } from '../api/outline';
import { accessLabel } from '../accessLabel';
import { stepHref } from '../paths';
import { percent } from '../progress';
import styles from './ProgramOutline.module.css';

type Props = { outline: Outline; currentStepId?: string; now: Date };

export function ProgramOutline({ outline, currentStepId, now }: Props) {
  const { program, modules, completed, total } = outline;
  return (
    <nav aria-label={`${program.title} outline`} className={styles.outline}>
      <ProgressBar
        value={percent(completed, total)}
        label="Program progress"
        valueText={`${completed} of ${total} lessons complete`}
      />
      <Stack gap="loose" as="ol" className={styles.list}>
        {modules.map((mod) => {
          const lock = accessLabel(mod.access, now);
          return (
            <li key={mod.id}>
              <Stack gap="tight">
                <div className={styles.moduleHead}>
                  <Heading level={3} variant="label">
                    {mod.title}
                  </Heading>
                  {lock ? <Badge tone="neutral">{lock}</Badge> : null}
                </div>
                <ol className={styles.list}>
                  {mod.steps.map((step) => (
                    <li key={step.id} className={styles.step} aria-current={step.id === currentStepId ? 'page' : undefined}>
                      <span className={styles.mark} aria-label={step.done ? 'Complete' : 'Not complete'}>
                        {step.done ? '✓' : '○'}
                      </span>
                      {step.access.kind === 'open' ? (
                        <AppLink href={stepHref(program.slug, step.id)}>{step.title}</AppLink>
                      ) : (
                        <Text as="span" tone="muted">
                          {step.title}
                        </Text>
                      )}
                      {step.status === 'draft' ? <Badge tone="warning">Draft</Badge> : null}
                    </li>
                  ))}
                </ol>
              </Stack>
            </li>
          );
        })}
      </Stack>
    </nav>
  );
}
