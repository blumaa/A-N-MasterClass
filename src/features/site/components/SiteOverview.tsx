// Studio > Site: pages, blog posts, legal checklist (G25), create forms.
import { Badge, EmptyState, Field, Heading, Input, ListGroup, Stack, Text } from '@/components/ui/mds';
import { ButtonLink, LinkRow } from '@/components/ui/links';
import type { Page, PageKind } from '@/lib/data/types';
import type { StudioSite } from '../api/site';
import { pageHref, studioNavHref, studioPageHref } from '../paths';
import { LEGAL_LABELS } from '../rules';
import { SiteForm } from './SiteForm';

function Status({ page }: { page: Page }) {
  return page.published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>;
}

function describe(page: Page): string {
  const flags = [page.isHome ? 'Home page' : null, page.legalKind ? LEGAL_LABELS[page.legalKind] : null].filter(Boolean);
  return [pageHref(page), ...flags].join(' · ');
}

function PageList({ pages, empty }: { pages: Page[]; empty: string }) {
  return pages.length === 0 ? (
    <EmptyState title={empty} />
  ) : (
    <ListGroup>
      {pages.map((p) => (
        <LinkRow key={p.id} href={studioPageHref(p.id)} title={p.title} description={describe(p)} trailing={<Status page={p} />} />
      ))}
    </ListGroup>
  );
}

function CreateForm({ kind, label }: { kind: PageKind; label: string }) {
  return (
    <SiteForm inline fields={{ op: 'createPage', kind }} submit={`Add ${label}`}>
      <Field label={`New ${label} title`}>
        <Input name="title" required />
      </Field>
    </SiteForm>
  );
}

export function SiteOverview({ site }: { site: StudioSite }) {
  return (
    <Stack gap="loose">
      {site.legalGaps.length > 0 ? (
        <Text role="alert" tone="danger">
          Missing published legal pages: {site.legalGaps.map((k) => LEGAL_LABELS[k]).join(', ')}. Create each page and pick its type under
          Page settings.
        </Text>
      ) : null}
      <div>
        <ButtonLink href={studioNavHref} variant="secondary">
          Edit navigation
        </ButtonLink>
      </div>
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Pages
        </Heading>
        <PageList pages={site.pages} empty="No pages yet" />
        <CreateForm kind="page" label="page" />
      </Stack>
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Blog posts
        </Heading>
        <PageList pages={site.posts} empty="No posts yet" />
        <CreateForm kind="post" label="post" />
      </Stack>
    </Stack>
  );
}
