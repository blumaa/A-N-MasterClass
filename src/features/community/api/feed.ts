// Member-facing community reads: channel feed, post page, directory, the viewer's communities.
import { ALWAYS_REACH } from '@/lib/auth/capabilities';
import type { Viewer } from '@/lib/auth/viewer';
import { grantIsActive } from '@/lib/data/grants';
import { spaceNames } from '@/lib/data/names';
import type { Repo } from '@/lib/data/repo';
import type { Channel, Post, Product } from '@/lib/data/types';
import type { MentionOption } from '@/lib/mentions/markup';
import { postPhotoHref } from '../paths';
import { channelAccess, communityAccess, readableChannels, type ChannelAccess, type CommunityAccess } from './access';
import {
  authorOf,
  buildThread,
  CHAT_LIMIT,
  messageItems,
  reactionCounts,
  type Author,
  type CommentNode,
  type MessageItem,
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
  /** Written by the viewer (others may report it). */
  mine: boolean;
  /** In order; `href` is the signed route. */
  photos: { id: string; href: string }[];
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
      /** The viewer's rules in this channel (post = post in a feed, send in a chat). */
      rules: ChannelAccess;
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
  rules: ChannelAccess;
  post: PostItem;
  comments: CommentNode[];
  members: MentionOption[];
};


/** A community product of the viewer's space; drafts only exist for those who reach them. */
export async function loadCommunity(repo: Repo, viewer: Viewer, slug: string, now: Date) {
  const community = await repo.productBySlug(viewer.space.id, slug);
  if (!community || community.kind !== 'community') return null;
  const access = await communityAccess(repo, viewer, community, now);
  if (community.status !== 'published' && !access.read) return null;
  return { community, access };
}

async function postItems(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  posts: readonly Post[],
  rules: ChannelAccess,
): Promise<PostItem[]> {
  const visible = rules.moderatePosts ? posts : posts.filter((p) => p.hiddenAt === null);
  const ids = visible.map((p) => p.id);
  const [who, reactions, comments, photos] = await Promise.all([
    spaceNames(repo, viewer.space.id),
    repo.reactions('post', ids),
    repo.comments('post', ids),
    repo.postPhotos(ids),
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
    commentCount: comments.filter((c) => c.targetId === p.id && (rules.moderateComments || c.hiddenAt === null)).length,
    canDelete: rules.moderatePosts || p.authorId === me,
    mine: p.authorId === me,
    photos: photos
      .filter((ph) => ph.postId === p.id)
      .map((ph) => ({ id: ph.id, href: postPhotoHref(community.slug, p.id, ph.id) })),
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
  const rules = await channelAccess(repo, access, channel, me);
  const [posts, messages, members] = await Promise.all([
    isChat ? [] : repo.posts(channel.id).then((rows) => postItems(repo, viewer, community, rows, rules)),
    isChat ? chatLines(repo, viewer, community, { channelId: channel.id }, rules.moderatePosts) : [],
    directory(repo, community, now),
  ]);
  return {
    kind: 'open',
    community,
    access,
    channels,
    channel,
    rules,
    posts,
    messages,
    members: mentionOptions(members),
  };
}

/** Latest lines of a chat channel or DM thread, shaped for the viewer. */
export async function chatLines(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  where: { channelId: string } | { threadId: string },
  moderate: boolean,
): Promise<MessageItem[]> {
  const [rows, names] = await Promise.all([repo.messages(where, CHAT_LIMIT), spaceNames(repo, viewer.space.id)]);
  return messageItems(rows, names, viewer.profile?.id ?? null, moderate, community.slug);
}

export async function postPage(repo: Repo, viewer: Viewer, slug: string, postId: string, now: Date): Promise<PostPage | null> {
  const found = await loadCommunity(repo, viewer, slug, now);
  if (!found?.access.read) return null;
  const { community, access } = found;
  const row = await repo.post(postId);
  const channel = row ? await repo.channel(row.channelId) : null;
  if (!row || !channel || channel.communityId !== community.id) return null;
  const me = viewer.profile!.id;
  const rules = await channelAccess(repo, access, channel, me);
  if (!rules.read || (row.hiddenAt !== null && !rules.moderatePosts)) return null;
  const commentsWithReactions = repo
    .comments('post', [row.id])
    .then(async (cs) => ({ cs, reactions: await repo.reactions('comment', cs.map((c) => c.id)) }));
  const [[post], { cs: comments, reactions }, who, members, channels] = await Promise.all([
    postItems(repo, viewer, community, [row], rules),
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
    rules,
    post: post!,
    comments: buildThread(comments, reactions, who, viewer.profile?.id ?? null, rules.moderateComments),
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
