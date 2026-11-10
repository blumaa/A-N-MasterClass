// Direct message reads: inbox with unread marks, one thread, and who the viewer may message.
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { DmRead, DmThread, Message, Product } from '@/lib/data/types';
import { canReply, canStart, dmContext, otherOf } from './chat';
import { chatLines, spaceNames } from './feed';
import { authorOf, type Author, type MessageItem } from './present';

export type InboxItem = {
  id: string;
  other: Author;
  last: { body: string; createdAt: Date; mine: boolean } | null;
  unread: boolean;
};

export type DmThreadPage = {
  threadId: string;
  other: Author;
  messages: MessageItem[];
  canSend: boolean;
  /** The viewer blocked the other person. */
  blocking: boolean;
};

/** Unread = the latest message is from the other side and came after the viewer last opened the thread. */
export const isUnread = (last: Message | null, me: string, read: DmRead | undefined): boolean =>
  last !== null && last.authorId !== me && (!read || last.createdAt > read.readAt);

const lastMessage = async (repo: Repo, thread: DmThread): Promise<Message | null> =>
  (await repo.messages({ threadId: thread.id }, 1))[0] ?? null;

export async function dmInbox(repo: Repo, viewer: Viewer, community: Product, now: Date): Promise<InboxItem[] | null> {
  const dm = await dmContext(repo, viewer, community, now);
  const me = viewer.profile?.id;
  if (!dm || !me) return null;
  const threads = await repo.dmThreads(community.id, me);
  const [lasts, reads, names] = await Promise.all([
    Promise.all(threads.map((t) => lastMessage(repo, t))),
    repo.dmReads(
      me,
      threads.map((t) => t.id),
    ),
    spaceNames(repo, viewer.space.id),
  ]);
  return threads
    .map((t, i) => {
      const last = lasts[i] ?? null;
      return {
        id: t.id,
        other: authorOf(names, otherOf(t, me)),
        last: last && { body: last.body, createdAt: last.createdAt, mine: last.authorId === me },
        unread: isUnread(
          last,
          me,
          reads.find((r) => r.threadId === t.id),
        ),
      };
    })
    .toSorted((a, b) => (b.last?.createdAt.getTime() ?? 0) - (a.last?.createdAt.getTime() ?? 0));
}

/** Count of threads with unread messages (nav badge). */
export async function unreadDms(repo: Repo, viewer: Viewer, community: Product, now: Date): Promise<number> {
  return ((await dmInbox(repo, viewer, community, now)) ?? []).filter((t) => t.unread).length;
}

/** One thread of the viewer; marks it read. Null when missing or not theirs. */
export async function dmThreadPage(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  threadId: string,
  now: Date,
): Promise<DmThreadPage | null> {
  const me = viewer.profile?.id;
  const thread = await repo.dmThread(threadId);
  if (!me || !thread || thread.communityId !== community.id || (thread.aId !== me && thread.bId !== me)) return null;
  const dm = await dmContext(repo, viewer, community, now);
  if (!dm) return null;
  const other = otherOf(thread, me);
  const [messages, names] = await Promise.all([
    chatLines(repo, viewer, { threadId }, false),
    spaceNames(repo, viewer.space.id),
    repo.markDmRead(threadId, me, now),
  ]);
  return {
    threadId,
    other: authorOf(names, other),
    messages,
    canSend: canReply(dm, me, other),
    blocking: dm.blocks.some((b) => b.blockerId === me && b.blockedId === other),
  };
}

/** Profile ids the viewer may start a DM with (members page buttons). */
export async function dmTargets(repo: Repo, viewer: Viewer, community: Product, now: Date): Promise<Set<string>> {
  const dm = await dmContext(repo, viewer, community, now);
  const me = viewer.profile?.id;
  if (!dm || !me) return new Set();
  return new Set([...dm.memberIds].filter((id) => canStart(dm, me, id)));
}

/** Side-nav extras: Members link (directory toggle) and Messages link with unread count (DMs on). */
export type CommunityNav = { directory: boolean; dms: { unread: number } | null };

export async function communityNav(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  directory: boolean,
  now: Date,
): Promise<CommunityNav> {
  const dm = await dmContext(repo, viewer, community, now);
  if (!dm?.enabled) return { directory, dms: null };
  return { directory, dms: { unread: await unreadDms(repo, viewer, community, now) } };
}
