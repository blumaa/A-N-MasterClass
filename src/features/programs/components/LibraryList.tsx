// Student library: program cards with cover, spelled-out progress and a Continue link.
import { ProductCard, ProductCardGrid } from '@/components/ProductCard/ProductCard';
import { EmptyState, ProgressBar, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import type { LibraryItem } from '../api/library';
import { programHref, stepHref } from '../paths';
import { percent } from '../progress';

type Props = { items: LibraryItem[]; imageSrc: (path: string) => string };

export function LibraryList({ items, imageSrc }: Props) {
  if (items.length === 0) return <EmptyState title="No programs yet" description="Programs you join show up here." />;
  return (
    <ProductCardGrid label="Programs">
      {items.map(({ program, completed, total, continueStepId, hasAccess }) => {
        const pct = percent(completed, total);
        return (
          <ProductCard
            key={program.id}
            title={program.title}
            subtitle={program.subtitle}
            coverSrc={program.coverPath ? imageSrc(program.coverPath) : undefined}
            headingLevel={2}
          >
            {hasAccess ? (
              <>
                <ProgressBar value={pct} label={`${program.title} progress`} valueText={`${completed} of ${total} lessons complete`} />
                <Text variant="note" tone="muted">{`${completed} of ${total} lessons · ${pct}%`}</Text>
              </>
            ) : null}
            <div>
              <ButtonLink
                href={hasAccess && continueStepId ? stepHref(program.slug, continueStepId) : programHref(program.slug)}
                variant={hasAccess ? 'primary' : 'secondary'}
              >
                {hasAccess ? (completed > 0 ? 'Continue' : 'Start') : 'View program'}
              </ButtonLink>
            </div>
          </ProductCard>
        );
      })}
    </ProductCardGrid>
  );
}
