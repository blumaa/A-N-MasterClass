// Draft/published badge shared by programs, modules, steps and offers.
import { Badge } from '@/components/ui/mds';
import { PUBLISH_STATUS_LABELS } from '@/lib/labels';
import type { PublishStatus } from '@/lib/programs/access';

export function PublishStatusBadge({ status }: { status: PublishStatus }) {
  return <Badge tone={status === 'published' ? 'success' : 'warning'}>{PUBLISH_STATUS_LABELS[status]}</Badge>;
}
