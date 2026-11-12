// Community files part of the fake repo: post photo rows, chat attachment checks, channel files.
// Same rules as supabase/migrations/20261112100000_community_files.sql.
import { channelFolder, POST_PHOTOS_MAX, threadFolder } from '@/lib/storage/communityFiles';
import { inFolder } from '@/lib/storage/uploadPath';
import { ATTACHMENT_INCOMPLETE, ConstraintError, FILE_IN_USE, FILE_OUTSIDE_FOLDER, TOO_MANY_PHOTOS } from '../errors';
import type { Repo } from '../repo';
import type { Attachment, PostPhoto } from '../types';
import type { Db } from './db';

type FilesRepo = Pick<Repo, 'postPhotos' | 'addPostPhotos' | 'deletePostPhoto' | 'channelFiles'>;

function must<T>(row: T | undefined, what: string): T {
  if (!row) throw new Error(`${what} not found`);
  return row;
}

const spaceOf = (db: Db, communityId: string): string => must(db.products.find((p) => p.id === communityId), 'community').spaceId;

function channelFolderOf(db: Db, channelId: string): string {
  const channel = must(db.channels.find((c) => c.id === channelId), 'channel');
  return channelFolder(spaceOf(db, channel.communityId), channel.communityId, channel.id);
}

function threadFolderOf(db: Db, threadId: string): string {
  const thread = must(db.dmThreads.find((t) => t.id === threadId), 'thread');
  return threadFolder(spaceOf(db, thread.communityId), thread.communityId, thread.id);
}

const pathTaken = (db: Db, path: string): boolean =>
  db.postPhotos.some((p) => p.path === path) || db.messages.some((m) => m.attachment?.path === path);

/** SQL: messages_attachment, messages_attachment_path, messages_attachment_path_key. */
export function checkAttachment(db: Db, channelId: string | null, threadId: string | null, a: Attachment): void {
  const name = a.name.trim().length;
  if (name < 1 || name > 255 || a.type.length === 0 || a.size < 1) throw new ConstraintError(ATTACHMENT_INCOMPLETE);
  const folder = channelId !== null ? channelFolderOf(db, channelId) : threadFolderOf(db, must(threadId ?? undefined, 'thread'));
  if (!inFolder(a.path, folder)) throw new ConstraintError(FILE_OUTSIDE_FOLDER);
  if (pathTaken(db, a.path)) throw new ConstraintError(FILE_IN_USE);
}

export function createFakeCommunityFiles(db: Db, id: (prefix: string) => string): FilesRepo {
  return {
    async postPhotos(postIds) {
      const ids = new Set(postIds);
      return db.postPhotos.filter((p) => ids.has(p.postId)).toSorted((a, b) => a.position - b.position);
    },
    async addPostPhotos(postId, paths) {
      const post = must(db.posts.find((p) => p.id === postId), 'post');
      const folder = channelFolderOf(db, post.channelId);
      const added: PostPhoto[] = [];
      for (const path of paths) {
        const current = db.postPhotos.filter((p) => p.postId === postId);
        if (!inFolder(path, folder)) throw new ConstraintError(FILE_OUTSIDE_FOLDER);
        if (current.length >= POST_PHOTOS_MAX) throw new ConstraintError(TOO_MANY_PHOTOS);
        if (pathTaken(db, path)) throw new ConstraintError(FILE_IN_USE);
        const position = current.reduce((m, p) => Math.max(m, p.position + 1), 0);
        const row: PostPhoto = { id: id('photo'), postId, path, position };
        db.postPhotos.push(row);
        added.push({ ...row });
      }
      return added;
    },
    async deletePostPhoto(photoId) {
      db.postPhotos = db.postPhotos.filter((p) => p.id !== photoId);
    },
    async channelFiles(channelId) {
      const posts = new Set(db.posts.filter((p) => p.channelId === channelId).map((p) => p.id));
      return [
        ...db.postPhotos.filter((p) => posts.has(p.postId)).map((p) => p.path),
        ...db.messages.flatMap((m) => (m.channelId === channelId && m.attachment ? [m.attachment.path] : [])),
      ];
    },
  };
}
