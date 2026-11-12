// Program title, subtitle, publish state, completion certificate (G26).
import { YesNoSelect } from '@/components/fields/fields';
import { Field, Input } from '@/components/ui/mds';
import type { Product } from '@/lib/data/types';
import { CommandForm } from './CommandForm';
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';

export function ProgramSettings({ program }: { program: Product }) {
  return (
    <CommandForm fields={{ op: 'updateProgram', programId: program.id }} submit="Save program">
      <Field label="Title">
        <Input name="title" defaultValue={program.title} required />
      </Field>
      <Field label="Subtitle">
        <Input name="subtitle" defaultValue={program.subtitle ?? ''} />
      </Field>
      <StatusSelect value={program.status} />
      <YesNoSelect
        name="certificates"
        label="Certificate"
        value={program.certificates}
        yes="Give a certificate at 100% completion"
        no="Off"
      />
    </CommandForm>
  );
}
