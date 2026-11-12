// Draft/published picker shared by program, module and step forms.
import { ChoiceSelect } from '@/components/fields/fields';
import { PUBLISH_STATUS_LABELS } from '@/lib/labels';
import { PUBLISH_STATUSES, type PublishStatus } from '@/lib/programs/access';

export function StatusSelect({ value }: { value: PublishStatus }) {
  return <ChoiceSelect name="status" label="Status" value={value} options={PUBLISH_STATUSES} labels={PUBLISH_STATUS_LABELS} />;
}
