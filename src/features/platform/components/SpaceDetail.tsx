'use client';
// Platform > one space: owners + claim link, status, domains (G1, G17).
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { ChoiceSelect } from '@/components/fields/fields';
import { AppLink } from '@/components/ui/links';
import { Badge, Field, Heading, Input, Select, Stack, Text } from '@/components/ui/mds';
import { SPACE_STATUSES } from '@/lib/data/types';
import { platformAction } from '../actions';
import type { PlatformSpaceDetail } from '../api/spaces';
import { SPACE_STATUS_LABELS } from '../spaceStatus';
import { OwnerClaimForm } from './ClaimForms';
import styles from './Platform.module.css';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack as="section" gap="base" aria-label={title}>
      <Heading level={2} variant="subtitle">
        {title}
      </Heading>
      {children}
    </Stack>
  );
}

export function SpaceDetail({ detail, spaceUrl }: { detail: PlatformSpaceDetail; spaceUrl: string }) {
  const { space, domains, owners } = detail;
  const slug = { slug: space.slug };
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {space.name}
        </Heading>
        <AppLink href={spaceUrl}>{spaceUrl}</AppLink>
      </Stack>

      <Section title="Owner">
        {owners.length === 0 ? <Text tone="secondary">No owner.</Text> : null}
        {owners.map((o) => (
          <Text key={o.email}>
            {o.displayName} ({o.email})
          </Text>
        ))}
        {owners.length > 0 ? <OwnerClaimForm slug={space.slug} /> : null}
      </Section>

      <Section title="Status">
        <Text variant="note" tone="secondary">
          Draft: only staff and platform admins see the site. Live: open to everyone.
        </Text>
        <ActionForm action={platformAction} done="Saved" fields={{ op: 'setStatus', ...slug }} submit="Save status" inline>
          <ChoiceSelect name="status" label="Status" value={space.status} options={SPACE_STATUSES} labels={SPACE_STATUS_LABELS} />
        </ActionForm>
      </Section>

      <Section title="Domains">
        <Text variant="note" tone="secondary">
          Add the domain in Vercel and the DNS first; this only tells the app which space it belongs to.
        </Text>
        <ul className={styles.domains}>
          {domains.map((d) => (
            <li key={d.host} className={styles.domain}>
              <span>{d.host}</span>
              {d.isPrimary ? <Badge>Primary</Badge> : null}
              <ActionForm
                action={platformAction}
                fields={{ op: 'removeDomain', ...slug, host: d.host }}
                submit="Remove"
                variant="danger"
                confirm={`Remove ${d.host}?`}
                inline
              />
            </li>
          ))}
        </ul>
        <ActionForm action={platformAction} done="Saved" fields={{ op: 'addDomain', ...slug }} submit="Add domain" inline>
          <Field label="Domain">
            <Input name="host" placeholder="courses.example.com" required />
          </Field>
          <Field label="Primary">
            <Select name="isPrimary" defaultValue="false">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </Select>
          </Field>
        </ActionForm>
      </Section>
    </Stack>
  );
}
