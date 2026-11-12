// Community file folders and cleanup. Objects outlive their rows (cascades do not reach Storage),
// so every delete collects paths first, writes the DB, then removes the objects.
import type { Repo } from '@/lib/data/repo';
import type { DmThread, Product } from '@/lib/data/types';
import { channelFolder, threadFolder } from '@/lib/storage/communityFiles';
import type { FileStore } from '@/lib/storage/fileStore';

export const channelFolderOf = (community: Product, channelId: string): string =>
  channelFolder(community.spaceId, community.id, channelId);

export const threadFolderOf = (community: Product, thread: DmThread): string =>
  threadFolder(community.spaceId, community.id, thread.id);

/** Photo paths of these posts. */
export const postFilePaths = async (repo: Repo, postIds: string[]): Promise<string[]> =>
  (await repo.postPhotos(postIds)).map((p) => p.path);

export async function removeFiles(files: FileStore, paths: readonly string[]): Promise<void> {
  if (paths.length > 0) await files.remove([...paths]);
}
