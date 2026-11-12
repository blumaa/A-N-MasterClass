// Community forms -> commands. Member forms (posts, comments, reactions), chat forms (messages,
// DMs, blocks), report forms and Studio forms (communities, channels, groups, settings, staff
// ticks, moderators, post approval) each post `op` plus their fields. Shared readers live in lib/forms/commands.
import type { Direction } from '@/lib/data/repo';
import type { Attachment } from '@/lib/data/types';
import {
  CHANNEL_KINDS,
  CHANNEL_PRIVACIES,
  GROUP_FEATURES,
  LEADERBOARD_VISIBILITIES,
  POINT_REASONS,
  POINT_VALUE_MAX,
  REPORT_TARGETS,
  type GroupFeature,
  type PointReason,
} from '@/lib/data/types';
import { body, field, flag, titleAndSlug, parser, productPatch } from '@/lib/forms/commands';
import { FormError, type FormReader as Reader } from '@/lib/forms/formReader';
import type { ChatCommand } from './api/chat';
import type { CommunityCommand } from './api/commands';
import type { ReportCommand } from './api/reports';
import type { StudioCommunityCommand } from './api/studio';

const DIRECTIONS: readonly Direction[] = ['up', 'down'];
const REVIEW_DECISIONS = ['approve', 'reject'] as const;

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

/** Post photo paths (repeated `photo` fields); omitted when none. */
function photos(r: Reader): { photos?: string[] } {
  const paths = r.all('photo');
  return paths.length === 0 ? {} : { photos: paths };
}

/** Upload paths for a photo edit: at least one. */
function somePhotos(r: Reader): string[] {
  const paths = r.all('photo');
  if (paths.length === 0) throw new FormError('Add a photo first.');
  return paths;
}

/** The uploaded file of a chat line, if any. */
function attachment(r: Reader): Attachment | undefined {
  if (!r.raw('attachmentPath')) return undefined;
  const size = Number(r.required('attachmentSize'));
  if (!Number.isInteger(size) || size <= 0) throw new FormError('The file size is not valid.');
  return { path: r.required('attachmentPath'), name: r.required('attachmentName'), type: r.required('attachmentType'), size };
}

/** A chat line: text, a file or both. */
function line(r: Reader): { body: string; attachment?: Attachment } {
  const file = attachment(r);
  return file ? { body: r.raw('body') ?? '', attachment: file } : { body: body(r) };
}

const MEMBER: Record<CommunityCommand['op'], (r: Reader) => CommunityCommand> = {
  createPost: (r) => ({ op: 'createPost', channelId: r.required('channelId'), body: body(r), ...photos(r) }),
  addPostPhotos: (r) => ({ op: 'addPostPhotos', postId: r.required('postId'), photos: somePhotos(r) }),
  removePostPhoto: (r) => ({ op: 'removePostPhoto', postId: r.required('postId'), photoId: r.required('photoId') }),
  deletePost: (r) => ({ op: 'deletePost', postId: r.required('postId') }),
  hidePost: (r) => ({ op: 'hidePost', postId: r.required('postId'), hidden: flag(r, 'hidden') }),
  pinPost: (r) => ({ op: 'pinPost', postId: r.required('postId'), pinned: flag(r, 'pinned') }),
  lockPost: (r) => ({ op: 'lockPost', postId: r.required('postId'), locked: flag(r, 'locked') }),
  reviewPost: (r) => ({ op: 'reviewPost', postId: r.required('postId'), decision: r.oneOf('decision', REVIEW_DECISIONS) }),
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
  sendMessage: (r) => ({ op: 'sendMessage', channelId: r.required('channelId'), ...line(r) }),
  deleteMessage: (r) => ({ op: 'deleteMessage', messageId: r.required('messageId') }),
  startDm: (r) => ({ op: 'startDm', communityId: r.required('communityId'), recipientId: r.required('recipientId') }),
  sendDm: (r) => ({ op: 'sendDm', threadId: r.required('threadId'), ...line(r) }),
  block: (r) => ({ op: 'block', communityId: r.required('communityId'), profileId: r.required('profileId'), on: flag(r, 'on') }),
};

/** Feature toggles present in the form. */
const groupFeatures = (r: Reader): Partial<Record<GroupFeature, boolean>> =>
  Object.fromEntries(GROUP_FEATURES.flatMap((f) => (r.raw(f) === undefined ? [] : [[f, flag(r, f)]])));

const STUDIO: Record<StudioCommunityCommand['op'], (r: Reader) => StudioCommunityCommand> = {
  createCommunity: (r) => ({ op: 'createCommunity', ...titleAndSlug(r) }),
  updateCommunity: (r) => ({
    op: 'updateCommunity',
    communityId: r.required('communityId'),
    patch: productPatch(r),
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
  setChannelModerator: (r) => ({
    op: 'setChannelModerator',
    channelId: r.required('channelId'),
    profileId: r.required('profileId'),
    on: flag(r, 'on'),
  }),
  setPostApproval: (r) => ({
    op: 'setPostApproval',
    communityId: r.required('communityId'),
    profileId: r.required('profileId'),
    on: flag(r, 'on'),
  }),
  setStaff: (r) => ({ op: 'setStaff', communityId: r.required('communityId'), profileId: r.required('profileId'), on: flag(r, 'on') }),
};

const RESOLUTIONS = ['dismiss', 'remove', 'hide'] as const;

/** Reason is optional; its length is the DB's job. */
const REPORT: Record<ReportCommand['op'], (r: Reader) => ReportCommand> = {
  report: (r) => ({
    op: 'report',
    targetType: r.oneOf('targetType', REPORT_TARGETS),
    targetId: r.required('targetId'),
    reason: r.raw('reason') || null,
  }),
  resolveReport: (r) => ({ op: 'resolveReport', reportId: r.required('reportId'), action: r.oneOf('action', RESOLUTIONS) }),
};

export const communityCommandFromForm = parser<CommunityCommand>(MEMBER);
export const studioCommunityCommandFromForm = parser<StudioCommunityCommand>(STUDIO);
export const chatCommandFromForm = parser<ChatCommand>(CHAT);
export const reportCommandFromForm = parser<ReportCommand>(REPORT);
