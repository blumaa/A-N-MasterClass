// Generic editor for one page section, driven by SECTION_SPECS (G11). Posts fields as
// `f.<name>` and item rows as `i.<row>.<name>`; one blank row adds an item, blank rows drop.
import { Badge, Card, CardBody, Field, Heading, Input, Select, Stack, Text, Textarea } from '@/components/ui/mds';
import { SECTION_SPECS, type FieldSpec, type SiteSection } from '@/lib/site/sections';
import { SiteForm } from './SiteForm';
import styles from './SiteEditor.module.css';

export type ProgramOption = { slug: string; title: string };

type Props = { pageId: string; section: SiteSection; programs: readonly ProgramOption[]; first: boolean; last: boolean };

const HINTS: Partial<Record<FieldSpec['type'], string>> = {
  href: 'A site path like /programs, or a full https:// link.',
  vimeo: 'Paste the Vimeo link or the video id.',
};

function Control({ spec, name, value, programs }: { spec: FieldSpec; name: string; value: string; programs: readonly ProgramOption[] }) {
  switch (spec.type) {
    case 'textarea':
      return <Textarea name={name} defaultValue={value} rows={4} />;
    case 'program':
      return (
        <Select name={name} defaultValue={value}>
          <option value="">Choose a program</option>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </Select>
      );
    default:
      return <Input name={name} defaultValue={value} />;
  }
}

function SpecField({ spec, name, value, programs }: { spec: FieldSpec; name: string; value: string; programs: readonly ProgramOption[] }) {
  return (
    <Field label={spec.label} hint={HINTS[spec.type]} required={spec.required}>
      <Control spec={spec} name={name} value={value} programs={programs} />
    </Field>
  );
}

export function SectionEditor({ pageId, section, programs, first, last }: Props) {
  const spec = SECTION_SPECS[section.kind];
  const ref = { pageId, sectionId: section.id };
  const rows = spec.item ? [...section.items, {}] : [];
  return (
    <Card>
      <CardBody>
        <Stack gap="base">
          <div className={styles.head}>
            <Heading level={3} variant="subtitle">
              {spec.label}
            </Heading>
            {section.hidden ? <Badge tone="warning">Hidden</Badge> : null}
          </div>

          <SiteForm fields={{ op: 'updateSection', ...ref }} submit="Save section" variant="primary">
            {spec.fields.map((f) => (
              <SpecField key={f.name} spec={f} name={`f.${f.name}`} value={section.fields[f.name] ?? ''} programs={programs} />
            ))}
            {spec.item ? (
              <fieldset className={styles.rows}>
                <legend>
                  <Text variant="label">{spec.item.label}s</Text>
                </legend>
                {rows.map((row, i) => (
                  <div key={i} className={styles.row}>
                    {spec.item!.fields.map((f) => (
                      <SpecField key={f.name} spec={{ ...f, required: false }} name={`i.${i}.${f.name}`} value={row[f.name] ?? ''} programs={programs} />
                    ))}
                  </div>
                ))}
                <Text variant="note" tone="secondary">
                  Fill the empty row to add one. Clear a row to remove it.
                </Text>
              </fieldset>
            ) : null}
          </SiteForm>

          <div className={styles.actions}>
            {first ? null : <SiteForm inline variant="ghost" submit="Move up" fields={{ op: 'moveSection', ...ref, direction: 'up' }} />}
            {last ? null : <SiteForm inline variant="ghost" submit="Move down" fields={{ op: 'moveSection', ...ref, direction: 'down' }} />}
            <SiteForm inline variant="ghost" submit={section.hidden ? 'Show' : 'Hide'} fields={{ op: 'toggleSection', ...ref }} />
            <SiteForm inline variant="ghost" submit="Duplicate" fields={{ op: 'duplicateSection', ...ref }} />
            <SiteForm inline variant="danger" submit="Remove" confirm="Remove this section?" fields={{ op: 'removeSection', ...ref }} />
          </div>
        </Stack>
      </CardBody>
    </Card>
  );
}
