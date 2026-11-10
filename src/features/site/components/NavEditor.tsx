// Header + footer links (G11). Rows post as `header.<row>.label|href`; one blank row per list adds a link.
import { Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import type { NavItem } from '@/lib/data/types';
import { SiteForm } from './SiteForm';
import styles from './SiteEditor.module.css';

function Rows({ prefix, title, items }: { prefix: 'header' | 'footer'; title: string; items: readonly NavItem[] }) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        {title}
      </Heading>
      {[...items, { label: '', href: '' }].map((item, i) => (
        <div key={i} className={styles.row}>
          <Field label="Label">
            <Input name={`${prefix}.${i}.label`} defaultValue={item.label} />
          </Field>
          <Field label="Link" hint="A site path like /about, or a full https:// link.">
            <Input name={`${prefix}.${i}.href`} defaultValue={item.href} />
          </Field>
        </div>
      ))}
    </Stack>
  );
}

export function NavEditor({ header, footer }: { header: readonly NavItem[]; footer: readonly NavItem[] }) {
  return (
    <SiteForm fields={{ op: 'saveNav' }} submit="Save navigation" variant="primary">
      <Text tone="secondary">Fill the empty row to add a link. Clear a row to remove it. Legal pages are added to the footer automatically.</Text>
      <Rows prefix="header" title="Header" items={header} />
      <Rows prefix="footer" title="Footer" items={footer} />
    </SiteForm>
  );
}
