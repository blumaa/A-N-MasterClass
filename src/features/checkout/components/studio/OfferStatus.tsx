import { Badge } from '@/components/ui/mds';
import type { PublishStatus } from '@/lib/data/types';

export const OfferStatus = ({ status }: { status: PublishStatus }) =>
  status === 'published' ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>;
