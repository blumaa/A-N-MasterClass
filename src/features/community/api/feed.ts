// Member-facing community reads: channel feed, post page, directory, the viewer's communities.
import { ALWAYS_REACH } from '@/lib/auth/capabilities';
import type { Viewer } from '@/lib/auth/viewer';
import { grantIsActive } from '@/lib/data/grants';
import type { Repo } from '@/lib/data/repo';
import type { Channel, Post, Product } from '@/lib/data/types';
import type { MentionOption } from '@/lib/mentions/markup';
import { channelAccess, communityAccess, readableChannels, type CommunityAccess } from './access';
import {
  authorOf,
  buildThread,
  CHAT_LIMIT,
  messageItems,
  reactionCounts,
  type Author,
  type CommentNode,
  type MessageItem,
  type Names,
  type ReactionCount,
} from './present';

export type PostItem = {
  id: string;
  channelId: string;
  body: string;
  author: Author;
  createdAt: Date;
  pinned: boolean;
  hidden: boolean;
  reactions: ReactionCount[];
  commentCount: number;
  canDelete: boolean;
};

export type DirectoryEntry = { id: string; name: string; staff: boolean };

export type CommunityPage =
  | { kind: 'locked'; community: Product }
  | {
      kind: 'open';
      community: Product;
      access: CommunityAccess;
      channels: Channel[];
      channel: Channel;
      /** Post in a feed channel, send in a chat channel. */
      canPost: boolean;
      /** Feed channels only. */
      posts: PostItem[];
      /** Chat channels only: the latest CHAT_LIMIT lines, oldest first. */
      messages: MessageItem[];
      members: MentionOption[];
    };

export type PostPage = {
  community: Product;
  access: CommunityAccess;
  /** Channels the viewer reads (side nav). */
  channels: Channel[];
  channel: Channel;
  post: PostItem;
  comments: CommentNode[];
  members: MentionOption[];
};

/** Display names of a space, by profile id. */
export async function spaceNames(repo: Repo, spaceId: string): Promise<Names> {
  return new Map((await repo.spaceProfiles(spaceId)).map((sp) => [sp.profileId, sp.displayName]));
}

/** A community product of the viewer's space; drafts only exist for those who reach them. */
export async function loadCommunity(repo: Repo, viewer: Viewer, slug: string, now: Date) {
  const community = await repo.productBySlug(viewer.space.id, slug);
  if (!community || community.kind !== 'community') return null;
  const access = await communityAccess(repo, viewer, community, now);
  if (community.status !== 'published' && !access.read) return null;
  return { community, access };
}

async function postItems(repo: Repo, viewer: Viewer, posts: readonly Post[], access: CommunityAccess): Promise<PostItem[]> {
  const visible = access.moderatePosts ? posts : posts.filter((p) => p.hiddenAt === null);
  const ids = visible.map((p) => p.id);
  const [who, reactions, comments] = await Promise.all([
    spaceNames(repo, viewer.space.id),
    repo.reactions('post', ids),
    repo.comments('post', ids),
  ]);
  const me = viewer.profile?.id ?? null;
  return visible.map((p) => ({
    id: p.id,
    channelId: p.channelId,
    body: p.body,
    author: authorOf(who, p.authorId),
    createdAt: p.createdAt,
    pinned: p.pinned,
    hidden: p.hiddenAt !== null,
    reactions: reactionCounts(reactions, p.id, me),
    commentCount: comments.filter((c) => c.targetId === p.id && (access.moderateComments || c.hiddenAt === null)).length,
    canDelete: access.moderatePosts || p.authorId === me,
  }));
}

const mentionOptions = (entries: readonly DirectoryEntry[]): MentionOption[] => entries.map(({ id, name }) => ({ id, name }));

export async function communityPage(
  repo: Repo,
  viewer: Viewer,
  slug: string,
  channelId: string | null,
  now: Date,
): Promise<CommunityPage | null> {
  const found = await loadCommunity(repo, viewer, slug, now);
  if (!found) return null;
  const { community, access } = found;
  if (!access.read) return { kind: 'locked', community };
  const me = viewer.profile!.id;
  const channels = await readableChannels(repo, access, await repo.channels(community.id), me);
  const channel = channelId === null ? channels[0] : channels.find((c) => c.id === channelId);
  if (!channel) return null;
  const isChat = channel.kind === 'chat';
  const [rules, posts, messages, members] = await Promise.all([
    channelAccess(repo, access, channel, me),
    isChat ? [] : repo.posts(channel.id).then((rows) => postItems(repo, viewer, rows, access)),
    isChat ? chatLines(repo, viewer, { channelId: channel.id }, access.moderatePosts) : [],
    directory(repo, community, now),
  ]);
  return {
    kind: 'open',
    community,
    access,
    channels,
    channel,
    canPost: rules.post,
    posts,
    messages,
    members: mentionOptions(members),
  };
}

/** Latest lines of a chat channel or DM thread, shaped for the viewer. */
export async function chatLines(
  repo: Repo,
  viewer: Viewer,
  where: { channelId: string } | { threadId: string },
  moderate: boolean,
): Promise<MessageItem[]> {
  const [rows, names] = await Promise.all([repo.messages(where, CHAT_LIMIT), spaceNames(repo, viewer.space.id)]);
  return messageItems(rows, names, viewer.profile?.id ?? null, moderate);
}

export async function postPage(repo: Repo, viewer: Viewer, slug: string, postId: string, now: Date): Promise<PostPage | null> {
  const found = await loadCommunity(repo, viewer, slug, now);
  if (!found?.access.read) return null;
  const { community, access } = found;
  const row = await repo.post(postId);
  if (!row || (row.hiddenAt !== null && !access.moderatePosts)) return null;
  const channel = await repo.channel(row.channelId);
  if (!channel || channel.communityId !== community.id) return null;
  const me = viewer.profile!.id;
  if (!(await channelAccess(repo, access, channel, me)).read) return null;
  const commentsWithReactions = repo
    .comments('post', [row.id])
    .then(async (cs) => ({ cs, reactions: await repo.reactions('comment', cs.map((c) => c.id)) }));
  const [[post], { cs: comments, reactions }, who, members, channels] = await Promise.all([
    postItems(repo, viewer, [row], access),
    commentsWithReactions,
    spaceNames(repo, viewer.space.id),
    directory(repo, community, now),
    repo.channels(community.id).then((all) => readableChannels(repo, access, all, me)),
  ]);
  return {
    community,
    access,
    channels,
    channel,
    post: post!,
    comments: buildThread(comments, reactions, who, viewer.profile?.id ?? null, access.moderateComments),
    members: mentionOptions(members),
  };
}

/** Active grant holders plus staff who reach the community (G15), by name. */
export async function directory(repo: Repo, community: Product, now: Date): Promise<DirectoryEntry[]> {
  const [grants, staff, ticked, who] = await Promise.all([
    repo.grantsForProduct(community.id),
    repo.members(community.spaceId),
    repo.communityStaff(community.id),
    spaceNames(repo, community.spaceId),
  ]);
  const staffIds = new Set(staff.filter((m) => ALWAYS_REACH.includes(m.role) || ticked.includes(m.profileId)).map((m) => m.profileId));
  const memberIds = grants.filter((g) => grantIsActive(g, now)).map((g) => g.profileId);
  const ids = new Set([...staffIds, ...memberIds]);
  return [...ids]
    .map((id) => ({ ...authorOf(who, id), staff: staffIds.has(id) }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** Communities of the space the viewer can read (library tiles). */
export async function myCommunities(repo: Repo, viewer: Viewer, now: Date): Promise<Product[]> {
  if (!viewer.profile) return [];
  const communities = (await repo.products(viewer.space.id)).filter((p) => p.kind === 'community');
  const access = await Promise.all(communities.map((c) => communityAccess(repo, viewer, c, now)));
  return communities.filter((_, i) => access[i]?.read);
}
