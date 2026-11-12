// Chat writes: messages in chat channels, direct messages (DMs) and blocks (G12, Kajabi Communities).
// DM rules (https://help.kajabi.com/en/articles/17174417-community-access-groups):
// - the community has DMs on (Studio setting);
// - both people are in the community and neither blocked the other;
// - to start a thread the sender is staff, or holds a group with DMs on; the owner is only
//   reachable while "founder DMs" is on.
// Replies need only the first two (a thread, once started, stays usable).
import type { Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { Attachment, Block, DmThread, Product } from '@/lib/data/types';
import { communityFileProblem } from '@/lib/storage/communityFiles';
import type { FileStore } from '@/lib/storage/fileStore';
import { channelScope, communityAccess, type CommunityAccess } from './access';
import { directory } from './feed';
import { removeFiles } from './files';

export type ChatCommand =
  | { op: 'sendMessage'; channelId: string; body: string; attachment?: Attachment }
  | { op: 'deleteMessage'; messageId: string }
  | { op: 'startDm'; communityId: string; recipientId: string }
  | { op: 'sendDm'; threadId: string; body: string; attachment?: Attachment }
  | { op: 'block'; communityId: string; profileId: string; on: boolean };

const OK: CommandResult = { ok: true };
const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

type Ctx = { repo: Repo; files: FileStore; viewer: Viewer; me: string; now: Date };

/** Everything the DM rules need about one viewer in one community. */
export type DmContext = {
  community: Product;
  access: CommunityAccess;
  enabled: boolean;
  founderDms: boolean;
  memberIds: Set<string>;
  ownerIds: Set<string>;
  blocks: Block[];
};

export async function dmContext(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  now: Date,
): Promise<DmContext | null> {
  if (!viewer.profile || community.kind !== 'community' || community.spaceId !== viewer.space.id) return null;
  const [access, settings, members, staff, blocks] = await Promise.all([
    communityAccess(repo, viewer, community, now),
    repo.communitySettings(community.id),
    directory(repo, community, now),
    repo.members(community.spaceId),
    repo.blocks(community.id, viewer.profile.id),
  ]);
  if (!access.read) return null;
  return {
    community,
    access,
    enabled: settings.dmsEnabled,
    founderDms: settings.founderDms,
    memberIds: new Set(members.map((m) => m.id)),
    ownerIds: new Set(staff.filter((m) => m.role === 'owner').map((m) => m.profileId)),
    blocks,
  };
}

const blockedEither = (dm: DmContext, other: string): boolean =>
  dm.blocks.some((b) => b.blockerId === other || b.blockedId === other);

/** May the viewer keep writing to `other` (thread exists)? */
export const canReply = (dm: DmContext, me: string, other: string): boolean =>
  dm.enabled && other !== me && dm.memberIds.has(other) && dm.memberIds.has(me) && !blockedEither(dm, other);

/** May the viewer open a new thread with `other`? */
export const canStart = (dm: DmContext, me: string, other: string): boolean =>
  canReply(dm, me, other) && (dm.access.staff || (dm.access.dms && (!dm.ownerIds.has(other) || dm.founderDms)));

export const otherOf = (thread: DmThread, me: string): string => (thread.aId === me ? thread.bId : thread.aId);

async function communityById(ctx: Ctx, communityId: string): Promise<DmContext | null> {
  const community = await ctx.repo.product(communityId);
  return community ? dmContext(ctx.repo, ctx.viewer, community, ctx.now) : null;
}

/** The thread and its DM context, if the viewer takes part in it. */
export async function threadScope(repo: Repo, viewer: Viewer, threadId: string, now: Date): Promise<{ thread: DmThread; dm: DmContext } | null> {
  const me = viewer.profile?.id;
  const thread = await repo.dmThread(threadId);
  if (!me || !thread || (thread.aId !== me && thread.bId !== me)) return null;
  const community = await repo.product(thread.communityId);
  const dm = community ? await dmContext(repo, viewer, community, now) : null;
  return dm ? { thread, dm } : null;
}

async function deleteMessage(ctx: Ctx, messageId: string): Promise<CommandResult> {
  const message = await ctx.repo.message(messageId);
  if (!message) return NOT_FOUND;
  if (message.channelId !== null) {
    const found = await channelScope(ctx.repo, ctx.viewer, message.channelId, ctx.now);
    if (!found) return NOT_FOUND;
    if (!found.rules.read) return FORBIDDEN;
    if (message.authorId !== ctx.me && !found.rules.moderatePosts) return FORBIDDEN;
  } else {
    if (!message.threadId || !(await threadScope(ctx.repo, ctx.viewer, message.threadId, ctx.now))) return NOT_FOUND;
    if (message.authorId !== ctx.me) return FORBIDDEN;
  }
  await ctx.repo.deleteMessage(message.id);
  await removeFiles(ctx.files, message.attachment ? [message.attachment.path] : []);
  return OK;
}

/** Type and size of an attached file; the repo checks its folder. */
function attachmentProblem(a: Attachment | undefined): CommandResult | null {
  const problem = a ? communityFileProblem('attachment', a.type, a.size) : null;
  return problem ? { ok: false, error: 'invalid', message: problem } : null;
}

async function run(ctx: Ctx, cmd: ChatCommand): Promise<CommandResult> {
  const { repo, me, now } = ctx;
  switch (cmd.op) {
    case 'sendMessage': {
      const found = await channelScope(ctx.repo, ctx.viewer, cmd.channelId, ctx.now);
      if (!found) return NOT_FOUND;
      if (found.channel.kind !== 'chat') return { ok: false, error: 'invalid', message: 'Feed channels take posts.' };
      if (!found.rules.post) return FORBIDDEN;
      const problem = attachmentProblem(cmd.attachment);
      if (problem) return problem;
      const message = await repo.createMessage({
        channelId: found.channel.id,
        threadId: null,
        authorId: me,
        body: cmd.body,
        attachment: cmd.attachment,
        createdAt: now,
      });
      return { ok: true, id: message.id };
    }
    case 'deleteMessage':
      return deleteMessage(ctx, cmd.messageId);
    case 'startDm': {
      const dm = await communityById(ctx, cmd.communityId);
      if (!dm) return NOT_FOUND;
      const existing = await repo.dmThreadBetween(dm.community.id, me, cmd.recipientId);
      if (existing) return canReply(dm, me, cmd.recipientId) ? { ok: true, id: existing.id } : FORBIDDEN;
      if (!canStart(dm, me, cmd.recipientId)) return FORBIDDEN;
      return { ok: true, id: (await repo.createDmThread(dm.community.id, me, cmd.recipientId)).id };
    }
    case 'sendDm': {
      const found = await threadScope(repo, ctx.viewer, cmd.threadId, now);
      if (!found) return NOT_FOUND;
      if (!canReply(found.dm, me, otherOf(found.thread, me))) return FORBIDDEN;
      const problem = attachmentProblem(cmd.attachment);
      if (problem) return problem;
      const message = await repo.createMessage({
        channelId: null,
        threadId: found.thread.id,
        authorId: me,
        body: cmd.body,
        attachment: cmd.attachment,
        createdAt: now,
      });
      await repo.markDmRead(found.thread.id, me, now);
      return { ok: true, id: message.id };
    }
    case 'block': {
      const dm = await communityById(ctx, cmd.communityId);
      if (!dm) return NOT_FOUND;
      if (cmd.profileId === me || !dm.memberIds.has(cmd.profileId)) return { ok: false, error: 'invalid', message: 'Not a member.' };
      await repo.setBlock({ communityId: dm.community.id, blockerId: me, blockedId: cmd.profileId }, cmd.on);
      return OK;
    }
  }
}

export async function chatCommand(repo: Repo, files: FileStore, viewer: Viewer, cmd: ChatCommand, now: Date): Promise<CommandResult> {
  if (!viewer.profile) return FORBIDDEN;
  try {
    return await run({ repo, files, viewer, me: viewer.profile.id, now }, cmd);
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
