// Display names for shared enums. UI shows these, never the raw stored value.
import type { Role } from '@/lib/auth/capabilities';
import type { ProductKind } from '@/lib/data/types';
import type { PublishStatus } from '@/lib/programs/access';

export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  assistant: 'Assistant',
  support: 'Support',
};

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  program: 'Program',
  community: 'Community',
  coaching: 'Coaching',
  podcast: 'Podcast',
  download: 'Download',
};
