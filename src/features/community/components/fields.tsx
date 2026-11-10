// Small Studio selects shared by the community editors. Booleans post 'true' / 'false'.
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
