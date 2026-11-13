// Read checks for the signed-file routes: a post photo follows its post, a chat file its channel
// or DM thread. Null = 404 (missing, wrong community, or not for this viewer).
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { Attachment, Product } from '@/lib/data/types';
import type { PhotoSize } from '../paths';
import { channelScope } from './access';
import { threadScope } from './chat';
import { seesPost } from './visibility';

const inCommunity = (community: Product | null, slug: string): boolean => community?.slug === slug;

/** Path of a photo of a post the viewer sees (seesPost). Thumb size: its thumbnail, else the photo. */
export async function postPhotoPath(
  repo: Repo,
  viewer: Viewer,
  slug: string,
  postId: string,
  photoId: string,
  size: PhotoSize,
  now: Date,
): Promise<string | null> {
  const post = await repo.post(postId);
  const scope = post ? await channelScope(repo, viewer, post.channelId, now) : null;
  if (!post || !scope?.rules.read || !inCommunity(scope.community, slug)) return null;
  if (!seesPost(scope.rules.moderatePosts, post, viewer.profile?.id ?? null)) return null;
  const photo = (await repo.postPhotos([postId])).find((p) => p.id === photoId);
  if (!photo) return null;
  return size === 'thumb' ? (photo.thumbPath ?? photo.path) : photo.path;
}

/** File of a chat line the viewer reads: channel readers, or the two people in a DM thread. */
export async function attachmentFile(repo: Repo, viewer: Viewer, slug: string, messageId: string, now: Date): Promise<Attachment | null> {
  const message = await repo.message(messageId);
  if (!message?.attachment) return null;
  if (message.channelId !== null) {
    const scope = await channelScope(repo, viewer, message.channelId, now);
    return scope?.rules.read && inCommunity(scope.community, slug) ? message.attachment : null;
  }
  const found = message.threadId ? await threadScope(repo, viewer, message.threadId, now) : null;
  const community = found ? await repo.product(found.thread.communityId) : null;
  return found && inCommunity(community, slug) ? message.attachment : null;
}
