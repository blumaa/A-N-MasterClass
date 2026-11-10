// Small Studio selects shared by feature editors. Booleans post 'true' / 'false'.
import { Field, Select } from '@/components/ui/mds';

type YesNoProps = { name: string; label: string; value: boolean; yes: string; no: string };

export function YesNoSelect({ name, label, value, yes, no }: YesNoProps) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={String(value)}>
        <option value="true">{yes}</option>
        <option value="false">{no}</option>
      </Select>
    </Field>
  );
}

type ChoiceProps<T extends string> = { name: string; label: string; value: T; options: readonly T[]; labels: Record<T, string> };

export function ChoiceSelect<T extends string>({ name, label, value, options, labels }: ChoiceProps<T>) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={value}>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// IANA zones from the runtime (Intl may leave out "UTC", so it is added first).
const ZONES: readonly string[] = ['UTC', ...Intl.supportedValuesOf('timeZone').filter((z) => z !== 'UTC')];

export function TimeZoneSelect({ value }: { value: string }) {
  return (
    <Field label="Time zone">
      <Select name="timeZone" defaultValue={value}>
        {ZONES.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </Select>
    </Field>
  );
}

type OptionsProps = { name: string; label: string; value: string; options: readonly { id: string; title: string }[]; none?: string };

/** Select over rows with id + title (access groups, channels); `none` adds an empty choice. */
export function RowSelect({ name, label, value, options, none }: OptionsProps) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={value}>
        {none !== undefined ? <option value="">{none}</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </Select>
    </Field>
  );
}
