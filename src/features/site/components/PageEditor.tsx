// Studio > Site > Page: publish state, settings, sections (draft), add section, versions (G11).
import { Badge, Checkbox, Field, Heading, Input, ListGroup, ListItem, Select, Stack, Text, Textarea } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { formatDate } from '@/lib/format/date';
import { LEGAL_KINDS, type Page, type PageVersion } from '@/lib/data/types';
import { SECTION_KINDS, SECTION_SPECS } from '@/lib/site/sections';
import { pageHref, studioPreviewHref } from '../paths';
import { LEGAL_LABELS } from '../rules';
import { SectionEditor, type ProgramOption } from './SectionEditor';
import { SiteForm } from './SiteForm';
import styles from './SiteEditor.module.css';

type Props = { page: Page; versions: readonly PageVersion[]; programs: readonly ProgramOption[] };

function PublishBar({ page }: { page: Page }) {
  const live = page.published !== null;
  const ref = { pageId: page.id };
  return (
    <div className={styles.actions}>
      {live ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
      <ButtonLink href={studioPreviewHref(page.id)} variant="ghost">
        Preview draft
      </ButtonLink>
      {live ? (
        <ButtonLink href={pageHref(page)} variant="ghost">
          View live
        </ButtonLink>
      ) : null}
      <SiteForm inline variant="primary" submit={live ? 'Publish changes' : 'Publish'} fields={{ op: 'publish', ...ref }} />
      {live ? <SiteForm inline variant="secondary" submit="Unpublish" fields={{ op: 'unpublish', ...ref }} /> : null}
    </div>
  );
}

function Settings({ page }: { page: Page }) {
  return (
    <details>
      <summary>Page settings</summary>
      <SiteForm fields={{ op: 'updatePage', pageId: page.id }} submit="Save settings">
        <Field label="Title">
          <Input name="title" defaultValue={page.title} required />
        </Field>
        <Field label="Address" hint="Lowercase letters, numbers and dashes.">
          <Input name="slug" defaultValue={page.slug} required />
        </Field>
        <Field label="Search title" hint="Shown in search results and link previews. Blank = page title.">
          <Input name="seoTitle" defaultValue={page.seoTitle ?? ''} />
        </Field>
        <Field label="Search description">
          <Textarea name="seoDescription" defaultValue={page.seoDescription ?? ''} rows={2} />
        </Field>
        {page.kind === 'page' ? (
          <>
            <Checkbox name="isHome" label="Use as home page" defaultChecked={page.isHome} />
            <Field label="Legal page" hint="Legal pages are linked in every footer.">
              <Select name="legalKind" defaultValue={page.legalKind ?? ''}>
                <option value="">Not a legal page</option>
                {LEGAL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LEGAL_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
      </SiteForm>
      <SiteForm variant="danger" submit="Delete page" confirm="Delete this page for good?" fields={{ op: 'deletePage', pageId: page.id }} />
    </details>
  );
}

function Versions({ page, versions }: { page: Page; versions: readonly PageVersion[] }) {
  if (versions.length === 0) return null;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Published versions
      </Heading>
      <Text tone="secondary">Restore copies a version into the draft. Publish to make it live.</Text>
      <ListGroup>
        {versions.map((v) => (
          <ListItem
            key={v.id}
            title={formatDate(v.publishedAt)}
            description={`${v.sections.length} sections`}
            trailing={<SiteForm inline variant="ghost" submit="Restore" fields={{ op: 'restoreVersion', pageId: page.id, versionId: v.id }} />}
          />
        ))}
      </ListGroup>
    </Stack>
  );
}

export function PageEditor({ page, versions, programs }: Props) {
  return (
    <Stack gap="loose">
      <PublishBar page={page} />
      <Settings page={page} />
      <Heading level={2} variant="title">
        Sections
      </Heading>
      {page.draft.length === 0 ? <Text tone="muted">No sections yet.</Text> : null}
      {page.draft.map((section, i) => (
        <SectionEditor key={section.id} pageId={page.id} section={section} programs={programs} first={i === 0} last={i === page.draft.length - 1} />
      ))}
      <SiteForm inline fields={{ op: 'addSection', pageId: page.id }} submit="Add section">
        <Field label="Section type">
          <Select name="kind" defaultValue="text">
            {SECTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {SECTION_SPECS[k].label}
              </option>
            ))}
          </Select>
        </Field>
      </SiteForm>
      <Versions page={page} versions={versions} />
    </Stack>
  );
}
