// Sidebar/program-page outline: modules, steps, checkmarks, lock/drip labels, progress (G6–G8).
// Certificate link (G26) is a plain anchor: full navigation to the PDF route.
import { Badge, Heading, Link, ProgressBar, Stack, Text } from '@/components/ui/mds';
import { AppLink } from '@/components/ui/links';
import type { Outline } from '../api/outline';
import { accessLabel } from '../accessLabel';
import { certificateHref, stepHref } from '../paths';
import { percent } from '../progress';
import styles from './ProgramOutline.module.css';

type Props = { outline: Outline; currentStepId?: string; now: Date };

export function ProgramOutline({ outline, currentStepId, now }: Props) {
  const { program, modules, completed, total } = outline;
  const pct = percent(completed, total);
  const summary = `${completed} of ${total} lessons complete`;
  return (
    <nav aria-label={`${program.title} outline`} className={styles.outline}>
      <Stack gap="tight">
        <ProgressBar value={pct} label="Program progress" valueText={summary} />
        <Text variant="note" tone="muted">
          {`${summary} · ${pct}%`}
        </Text>
      </Stack>
      {outline.certificateReady ? (
        <Link variant="standalone" href={certificateHref(program.slug)}>
          Download certificate
        </Link>
      ) : null}
      <Stack gap="loose" as="ol" className={styles.list}>
        {modules.map((mod) => {
          const lock = accessLabel(mod.access, now);
          return (
            <li key={mod.id}>
              <Stack gap="tight">
                <div>
                  <Heading level={3} variant="label">
                    {mod.title}
                  </Heading>
                  {lock ? (
                    <Text variant="note" tone="muted">
                      {lock}
                    </Text>
                  ) : null}
                </div>
                <ol className={styles.list}>
                  {mod.steps.map((step) => (
                    <li key={step.id} className={styles.step}>
                      <span className={styles.mark} aria-label={step.done ? 'Complete' : 'Not complete'}>
                        {step.done ? '✓' : '○'}
                      </span>
                      {step.access.kind === 'open' ? (
                        <AppLink href={stepHref(program.slug, step.id)} variant="plain" current={step.id === currentStepId}>
                          {step.title}
                        </AppLink>
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
