// Generic editor for one page section, driven by SECTION_SPECS (G11). Posts fields as
// `f.<name>` and item rows as `i.<row>.<name>`; one blank row adds an item, blank rows drop.
import { Badge, Card, CardBody, Field, Heading, Input, Select, Stack, Text, Textarea } from '@/components/ui/mds';
import { SECTION_SPECS, isRefType, type FieldSpec, type RefType, type SectionChoices, type SiteSection } from '@/lib/site/sections';
import { SiteForm } from './SiteForm';
import styles from './SiteEditor.module.css';

type Props = { pageId: string; section: SiteSection; choices: SectionChoices; first: boolean; last: boolean };

const HINTS: Partial<Record<FieldSpec['type'], string>> = {
  href: 'A site path like /programs, or a full https:// link.',
  vimeo: 'Paste the Vimeo link or the video id.',
};

const PLACEHOLDERS: Record<RefType, string> = { program: 'Choose a program', offer: 'Choose an offer' };

type FieldProps = { spec: FieldSpec; name: string; value: string; choices: SectionChoices };

function Control({ spec, name, value, choices }: FieldProps) {
  if (isRefType(spec.type)) {
    return (
      <Select name={name} defaultValue={value}>
        <option value="">{PLACEHOLDERS[spec.type]}</option>
        {choices[spec.type].map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.title}
          </option>
        ))}
      </Select>
    );
  }
  return spec.type === 'textarea' ? <Textarea name={name} defaultValue={value} rows={4} /> : <Input name={name} defaultValue={value} />;
}

function SpecField(props: FieldProps) {
  const { spec } = props;
  return (
    <Field label={spec.label} hint={HINTS[spec.type]} required={spec.required}>
      <Control {...props} />
    </Field>
  );
}

export function SectionEditor({ pageId, section, choices, first, last }: Props) {
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
              <SpecField key={f.name} spec={f} name={`f.${f.name}`} value={section.fields[f.name] ?? ''} choices={choices} />
            ))}
            {spec.item ? (
              <fieldset className={styles.rows}>
                <legend>
                  <Text variant="label">{spec.item.label}s</Text>
                </legend>
                {rows.map((row, i) => (
                  <div key={i} className={styles.row}>
                    {spec.item!.fields.map((f) => (
                      <SpecField key={f.name} spec={{ ...f, required: false }} name={`i.${i}.${f.name}`} value={row[f.name] ?? ''} choices={choices} />
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
