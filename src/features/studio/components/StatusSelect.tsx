// Draft/published picker shared by program, module and step forms.
import { Field, Select } from '@/components/ui/mds';
import type { PublishStatus } from '@/lib/data/types';

export function StatusSelect({ value }: { value: PublishStatus }) {
  return (
    <Field label="Status">
      <Select name="status" defaultValue={value}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
      </Select>
    </Field>
  );
}
