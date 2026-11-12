// Community file folders. Removal of objects whose rows go away runs through storage_trash (DB triggers).
import type { DmThread, Product } from '@/lib/data/types';
import { channelFolder, threadFolder } from '@/lib/storage/communityFiles';

export const channelFolderOf = (community: Product, channelId: string): string =>
  channelFolder(community.spaceId, community.id, channelId);

export const threadFolderOf = (community: Product, thread: DmThread): string =>
  threadFolder(community.spaceId, community.id, thread.id);
