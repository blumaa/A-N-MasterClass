// Who sees a post and whether it takes comments. Mirrors can_read_post() and post_open() in SQL.
import type { Post } from '@/lib/data/types';

type Visible = Pick<Post, 'hiddenAt' | 'status' | 'authorId'>;

/** In the channel feed: not hidden, and published or the viewer's own (pending/rejected). */
export const inFeed = (post: Visible, me: string | null): boolean =>
  post.hiddenAt === null && (post.status === 'published' || post.authorId === me);

/** Moderators of the channel see every post (review tabs); others what the feed shows. */
export const seesPost = (moderates: boolean, post: Visible, me: string | null): boolean => moderates || inFeed(post, me);

/** Published and not locked. */
export const postOpen = (post: Pick<Post, 'lockedAt' | 'status'>): boolean => post.lockedAt === null && post.status === 'published';
