// One published page or post. Exactly one h1: a leading hero on a page, else the title.
import { Heading, Stack, Text } from '@/components/ui/mds';
import type { PageMeta } from '@/lib/data/types';
import { formatDate } from '@/lib/format/date';
import type { SiteSection } from '@/lib/site/sections';
import type { SectionRefs } from '../api/site';
import { Band, Sections } from './Sections';
import styles from './Sections.module.css';

type Props = { page: PageMeta; sections: SiteSection[]; refs: SectionRefs };

export function PublicPageView({ page, sections, refs }: Props) {
  const heroLeads = page.kind === 'page' && sections[0]?.kind === 'hero';
  return (
    <article className={page.kind === 'post' ? styles.post : undefined}>
      {heroLeads ? null : (
        <Band kind="title">
          <Stack gap="tight">
            <Heading level={1} variant="display">
              {page.title}
            </Heading>
            {page.kind === 'post' && page.publishedAt ? (
              <Text variant="meta" tone="secondary">
                <time dateTime={page.publishedAt.toISOString()}>{formatDate(page.publishedAt)}</time>
              </Text>
            ) : null}
          </Stack>
        </Band>
      )}
      <Sections sections={sections} refs={refs} headingLevel={heroLeads ? 1 : 2} />
    </article>
  );
}
