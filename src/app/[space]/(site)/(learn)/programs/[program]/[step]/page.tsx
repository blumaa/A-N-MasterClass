// Step page (G6/G7): outline beside, parts, Complete & Continue, lesson comments, prev/next.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/links';
import { EmptyState, Heading, Stack, Text } from '@/components/ui/mds';
import { communityAction } from '@/app/[space]/communityActions';
import { stepThread } from '@/features/community/api/notifications';
import { CommentThread } from '@/features/community/components/CommentThread';
import { accessLabel } from '@/features/programs/accessLabel';
import { stepOpen, stepView } from '@/features/programs/api/step';
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
  const repo = getRepo();
  const view = await stepView(repo, viewer, program, step, now);
  if (!view) return null;
  const thread = await stepThread(repo, viewer, view.step.id, (id) => stepOpen(repo, viewer, id, now));
  return { view, now, thread, signedIn: viewer.profile !== null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.view.step.title } : {};
}

export default async function StepPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { view, now, thread, signedIn } = data;
  const { outline, step, access, parts, quizzes, prevStepId, nextStepId } = view;
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
              <StepParts parts={parts} programSlug={slug} quizzes={quizzes} />
              {signedIn ? <CompleteButton programSlug={slug} stepId={step.id} done={step.done} /> : null}
              {thread ? (
                <CommentThread
                  action={communityAction}
                  target={{ type: 'step', id: step.id }}
                  comments={thread.comments}
                  members={[]}
                  canComment={thread.canComment}
                  moderate={thread.moderate}
                />
              ) : null}
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
