// Student library: programs in this space with progress + continue link.
import { Card, CardBody, EmptyState, Heading, ProgressBar, Stack, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import type { LibraryItem } from '../api/library';
import { programHref, stepHref } from '../paths';
import { percent } from '../progress';

export function LibraryList({ items }: { items: LibraryItem[] }) {
  if (items.length === 0) return <EmptyState title="No programs yet" description="Programs you join show up here." />;
  return (
    <Stack gap="base">
      {items.map(({ program, completed, total, continueStepId, hasAccess }) => (
        <Card key={program.id}>
          <CardBody>
            <Stack gap="tight">
              <Heading level={2} variant="subtitle">
                {program.title}
              </Heading>
              {program.subtitle ? <Text tone="muted">{program.subtitle}</Text> : null}
              {hasAccess ? (
                <ProgressBar
                  value={percent(completed, total)}
                  label={`${program.title} progress`}
                  valueText={`${completed} of ${total} lessons complete`}
                />
              ) : null}
              <div>
                <ButtonLink
                  href={hasAccess && continueStepId ? stepHref(program.slug, continueStepId) : programHref(program.slug)}
                  variant={hasAccess ? 'primary' : 'secondary'}
                >
                  {hasAccess ? (completed > 0 ? 'Continue' : 'Start') : 'View program'}
                </ButtonLink>
              </div>
            </Stack>
          </CardBody>
        </Card>
      ))}
    </Stack>
  );
}
