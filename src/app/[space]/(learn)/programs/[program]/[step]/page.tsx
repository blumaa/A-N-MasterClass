// Step page (G6/G7): outline beside, parts, Complete & Continue, prev/next.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/links';
import { EmptyState, Heading, Stack, Text } from '@/components/ui/mds';
import { accessLabel } from '@/features/programs/accessLabel';
import { stepView } from '@/features/programs/api/step';
import { CompleteButton } from '@/features/programs/components/CompleteButton';
import { ProgramOutline } from '@/features/programs/components/ProgramOutline';
import { StepParts } from '@/features/programs/components/StepParts';
import { stepHref } from '@/features/programs/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import styles from './page.module.css';

type Props = PageProps<'/[space]/programs/[program]/[step]'>;

async function load(params: Props['params']) {
  const { space, program, step } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const now = new Date();
  const view = await stepView(getRepo(), viewer, program, step, now);
  return view ? { view, now, signedIn: viewer.profile !== null } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.view.step.title } : {};
}

export default async function StepPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { view, now, signedIn } = data;
  const { outline, step, access, parts, prevStepId, nextStepId } = view;
  const slug = outline.program.slug;
  const blocked = accessLabel(access, now);
  return (
    <div className={styles.layout}>
      <aside className={styles.side}>
        <ProgramOutline outline={outline} currentStepId={step.id} now={now} />
      </aside>
      <article className={styles.body}>
        <Stack gap="loose">
          <Heading level={1} variant="title">
            {step.title}
          </Heading>
          {step.description ? <Text tone="secondary">{step.description}</Text> : null}
          {blocked ? (
            <EmptyState title="Locked" description={blocked} />
          ) : (
            <>
              <StepParts parts={parts} />
              {signedIn ? <CompleteButton programSlug={slug} stepId={step.id} done={step.done} /> : null}
            </>
          )}
          <nav aria-label="Lesson" className={styles.pager}>
            {prevStepId ? (
              <ButtonLink href={stepHref(slug, prevStepId)} variant="ghost">
                Previous
              </ButtonLink>
            ) : (
              <span />
            )}
            {nextStepId ? (
              <ButtonLink href={stepHref(slug, nextStepId)} variant="ghost">
                Next
              </ButtonLink>
            ) : null}
          </nav>
        </Stack>
      </article>
    </div>
  );
}
