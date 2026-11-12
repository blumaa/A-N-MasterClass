// Display names for block kinds, shared by the block badge and the "Block type" select.
import type { PartKind } from '@/lib/data/types';

export const PART_KIND_LABELS: Record<PartKind, string> = {
  video: 'Video',
  text: 'Text',
  download: 'Download',
  image: 'Image',
  embed: 'Embed',
  quiz: 'Quiz',
};
