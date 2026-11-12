// Display names for space statuses, shared by the spaces table and the status select.
import type { SpaceStatus } from '@/lib/data/types';

export const SPACE_STATUS_LABELS: Record<SpaceStatus, string> = {
  draft: 'Draft',
  live: 'Live',
  archived: 'Archived',
};
