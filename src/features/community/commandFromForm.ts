// Community forms -> commands. Member forms (posts, comments, reactions), chat forms (messages,
// DMs, blocks) and Studio forms (communities, channels, groups, settings, staff ticks) each post
// `op` plus their fields. Booleans arrive as 'true' / 'false'.
import type { Direction } from '@/lib/data/repo';
import {
  CHANNEL_KINDS,
  CHANNEL_PRIVACIES,
  GROUP_FEATURES,
  LEADERBOARD_VISIBILITIES,
  POINT_REASONS,
  POINT_VALUE_MAX,
  type GroupFeature,
  type PointReason,
  type PublishStatus,
} from '@/lib/data/types';
import { FormError, formReader, parseForm, type FormReader as Reader } from '@/lib/forms/formReader';
import { slugify } from '@/lib/text/slugify';
import type { ChatCommand } from './api/chat';
import type { CommunityCommand } from './api/commands';
import type { StudioCommunityCommand } from './api/studio';

export type Parsed<C> = { ok: true; command: C } | { ok: false; message: string };

const BOOLEANS = ['true', 'false'] as const;
const STATUSES: readonly PublishStatus[] = ['draft', 'published'];
const DIRECTIONS: readonly Direction[] = ['up', 'down'];

export const flag = (r: Reader, name: string): boolean => r.oneOf(name, BOOLEANS) === 'true';
/** Whole number 0..POINT_VALUE_MAX. */
function pointValue(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > POINT_VALUE_MAX) throw new FormError(`Points must be a whole number from 0 to ${POINT_VALUE_MAX}.`);
  return n;
}
/** Point fields are named point_<reason>; only those present are read. */
function pointValues(r: Reader): { pointValues?: Partial<Record<PointReason, number>> } {
  const entries = POINT_REASONS.flatMap((reason) => {
    const v = r.raw(`point_${reason}`);
    return v === undefined ? [] : [[reason, pointValue(v)] as const];
  });
  return entries.length === 0 ? {} : { pointValues: Object.fromEntries(entries) };
}
export function body(r: Reader): string {
  const v = r.raw('body');
  if (!v) throw new FormError('Write something first.');
  return v;
}

const MEMBER: Record<CommunityCommand['op'], (r: Reader) => CommunityCommand> = {
  createPost: (r) => ({ op: 'createPost', channelId: r.required('channelId'), body: body(r) }),
  deletePost: (r) => ({ op: 'deletePost', postId: r.required('postId') }),
  hidePost: (r) => ({ op: 'hidePost', postId: r.required('postId'), hidden: flag(r, 'hidden') }),
  pinPost: (r) => ({ op: 'pinPost', postId: r.required('postId'), pinned: flag(r, 'pinned') }),
  createComment: (r) => ({
    op: 'createComment',
    target: { type: r.oneOf('targetType', ['post', 'step'] as const), id: r.required('targetId') },
    parentId: r.raw('parentId') || null,
    body: body(r),
  }),
  deleteComment: (r) => ({ op: 'deleteComment', commentId: r.required('commentId') }),
  hideComment: (r) => ({ op: 'hideComment', commentId: r.required('commentId'), hidden: flag(r, 'hidden') }),
  react: (r) => ({
    op: 'react',
    target: { type: r.oneOf('targetType', ['post', 'comment'] as const), id: r.required('targetId') },
    emoji: r.required('emoji'),
    on: flag(r, 'on'),
  }),
};

const CHAT: Record<ChatCommand['op'], (r: Reader) => ChatCommand> = {
  sendMessage: (r) => ({ op: 'sendMessage', channelId: r.required('channelId'), body: body(r) }),
  deleteMessage: (r) => ({ op: 'deleteMessage', messageId: r.required('messageId') }),
  startDm: (r) => ({ op: 'startDm', communityId: r.required('communityId'), recipientId: r.required('recipientId') }),
  sendDm: (r) => ({ op: 'sendDm', threadId: r.required('threadId'), body: body(r) }),
  block: (r) => ({ op: 'block', communityId: r.required('communityId'), profileId: r.required('profileId'), on: flag(r, 'on') }),
};

export const field = <K extends string, T>(r: Reader, name: K, read: () => T): Partial<Record<K, T>> =>
  r.raw(name) === undefined ? {} : ({ [name]: read() } as Partial<Record<K, T>>);

/** Feature toggles present in the form. */
const groupFeatures = (r: Reader): Partial<Record<GroupFeature, boolean>> =>
  Object.fromEntries(GROUP_FEATURES.flatMap((f) => (r.raw(f) === undefined ? [] : [[f, flag(r, f)]])));

const STUDIO: Record<StudioCommunityCommand['op'], (r: Reader) => StudioCommunityCommand> = {
  createCommunity: (r) => {
    const title = r.required('title');
    return { op: 'createCommunity', title, slug: r.raw('slug') || slugify(title) };
  },
  updateCommunity: (r) => ({
    op: 'updateCommunity',
    communityId: r.required('communityId'),
    patch: {
      ...field(r, 'title', () => r.required('title')),
      ...field(r, 'subtitle', () => r.raw('subtitle') || null),
      ...field(r, 'status', () => r.oneOf('status', STATUSES)),
    },
  }),
  createChannel: (r) => ({
    op: 'createChannel',
    communityId: r.required('communityId'),
    title: r.required('title'),
    kind: r.oneOf('kind', CHANNEL_KINDS),
    privacy: r.oneOf('privacy', CHANNEL_PRIVACIES),
    readOnly: flag(r, 'readOnly'),
    ...(r.raw('accessGroupId') ? { accessGroupId: r.required('accessGroupId') } : {}),
  }),
  updateChannel: (r) => ({
    op: 'updateChannel',
    channelId: r.required('channelId'),
    patch: {
      ...field(r, 'title', () => r.required('title')),
      ...field(r, 'privacy', () => r.oneOf('privacy', CHANNEL_PRIVACIES)),
      ...field(r, 'readOnly', () => flag(r, 'readOnly')),
    },
  }),
  deleteChannel: (r) => ({ op: 'deleteChannel', channelId: r.required('channelId') }),
  moveChannel: (r) => ({ op: 'moveChannel', channelId: r.required('channelId'), direction: r.oneOf('direction', DIRECTIONS) }),
  setChannelMember: (r) => ({
    op: 'setChannelMember',
    channelId: r.required('channelId'),
    profileId: r.required('profileId'),
    on: flag(r, 'on'),
  }),
  createGroup: (r) => ({ op: 'createGroup', communityId: r.required('communityId'), title: r.required('title') }),
  updateGroup: (r) => ({
    op: 'updateGroup',
    groupId: r.required('groupId'),
    patch: {
      ...field(r, 'title', () => r.required('title')),
      ...groupFeatures(r),
    },
  }),
  deleteGroup: (r) => ({ op: 'deleteGroup', groupId: r.required('groupId') }),
  saveSettings: (r) => ({
    op: 'saveSettings',
    communityId: r.required('communityId'),
    patch: {
      ...field(r, 'dmsEnabled', () => flag(r, 'dmsEnabled')),
      ...field(r, 'founderDms', () => flag(r, 'founderDms')),
      ...field(r, 'pointsEnabled', () => flag(r, 'pointsEnabled')),
      ...field(r, 'leaderboard', () => r.oneOf('leaderboard', LEADERBOARD_VISIBILITIES)),
      ...pointValues(r),
    },
  }),
  setStaff: (r) => ({ op: 'setStaff', communityId: r.required('communityId'), profileId: r.required('profileId'), on: flag(r, 'on') }),
};

export function parser<C extends { op: string }>(table: Record<C['op'], (r: Reader) => C>) {
  const ops = Object.keys(table) as C['op'][];
  return (form: FormData): Parsed<C> => {
    const r = formReader(form);
    const parsed = parseForm(() => table[r.oneOf('op', ops)](r));
    return parsed.ok ? { ok: true, command: parsed.value } : parsed;
  };
}

export const communityCommandFromForm = parser<CommunityCommand>(MEMBER);
export const studioCommunityCommandFromForm = parser<StudioCommunityCommand>(STUDIO);
export const chatCommandFromForm = parser<ChatCommand>(CHAT);
