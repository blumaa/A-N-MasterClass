// Row -> view shaping shared by feed, post page and step comments. Pure.
import type { Comment, Message, Reaction, ReactionEmoji } from '@/lib/data/types';
import { REACTION_EMOJIS } from '@/lib/data/types';
import { isImageType } from '@/lib/storage/communityFiles';
import { attachmentHref } from '../paths';

export type Author = { id: string; name: string };
export type ReactionCount = { emoji: ReactionEmoji; count: number; mine: boolean };

export type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  author: Author;
  createdAt: Date;
  hidden: boolean;
  reactions: ReactionCount[];
  canDelete: boolean;
  /** Written by the viewer (others may report it). */
  mine: boolean;
};
export type CommentNode = CommentItem & { replies: CommentItem[] };

/** A chat line's file; `href` is the signed route, `image` shows it inline. */
export type AttachmentItem = { name: string; type: string; size: number; image: boolean; href: string };

/** A chat line in a chat channel or a DM thread. */
export type MessageItem = {
  id: string;
  body: string;
  author: Author;
  createdAt: Date;
  canDelete: boolean;
  mine: boolean;
  attachment: AttachmentItem | null;
};

/** Chat and DM views load the latest messages only, oldest first. */
export const CHAT_LIMIT = 100;

/** Fallback when a space profile is missing (account deleted or never named). */
export const UNKNOWN_NAME = 'Member';

export type Names = ReadonlyMap<string, string>;

export const authorOf = (names: Names, id: string): Author => ({ id, name: names.get(id) ?? UNKNOWN_NAME });

/** Counts per emoji in REACTION_EMOJIS order; emojis nobody used are left out. */
export function reactionCounts(rows: readonly Reaction[], targetId: string, me: string | null): ReactionCount[] {
  const mine = rows.filter((r) => r.targetId === targetId);
  return REACTION_EMOJIS.flatMap((emoji) => {
    const hits = mine.filter((r) => r.emoji === emoji);
    return hits.length === 0 ? [] : [{ emoji, count: hits.length, mine: hits.some((r) => r.profileId === me) }];
  });
}

/** Comments the viewer may see: hidden ones (and replies under a hidden one) only for moderators. */
export function visibleComments(rows: readonly Comment[], moderate: boolean): Comment[] {
  if (moderate) return [...rows];
  const hiddenTop = new Set(rows.filter((c) => c.hiddenAt !== null).map((c) => c.id));
  return rows.filter((c) => c.hiddenAt === null && !(c.parentId && hiddenTop.has(c.parentId)));
}

/** One reply level (G12): top-level comments oldest first, each with its replies oldest first. */
export function buildThread(
  rows: readonly Comment[],
  reactions: readonly Reaction[],
  names: Names,
  me: string | null,
  moderate: boolean,
): CommentNode[] {
  const item = (c: Comment): CommentItem => ({
    id: c.id,
    parentId: c.parentId,
    body: c.body,
    author: authorOf(names, c.authorId),
    createdAt: c.createdAt,
    hidden: c.hiddenAt !== null,
    reactions: reactionCounts(reactions, c.id, me),
    canDelete: moderate || c.authorId === me,
    mine: c.authorId === me,
  });
  const visible = visibleComments(rows, moderate);
  return visible
    .filter((c) => c.parentId === null)
    .map((top) => ({ ...item(top), replies: visible.filter((c) => c.parentId === top.id).map(item) }));
}

/** Author or moderator deletes a chat line. `community` is the slug for file links. */
export const messageItems = (
  rows: readonly Message[],
  names: Names,
  me: string | null,
  moderate: boolean,
  community: string,
): MessageItem[] =>
  rows.map((m) => ({
    id: m.id,
    body: m.body,
    author: authorOf(names, m.authorId),
    createdAt: m.createdAt,
    canDelete: moderate || m.authorId === me,
    mine: m.authorId === me,
    attachment: m.attachment && {
      name: m.attachment.name,
      type: m.attachment.type,
      size: m.attachment.size,
      image: isImageType(m.attachment.type),
      href: attachmentHref(community, m.id),
    },
  }));
