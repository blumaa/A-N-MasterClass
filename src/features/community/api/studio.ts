// Studio for communities: reads + one command entry point. Same shape as studio curriculum:
// capability check (G15), then the owning community must be in the viewer's space and reached
// by the viewer (assistant/support only when ticked), then the write.
import { ALWAYS_REACH } from '@/lib/auth/capabilities';
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { ChannelPatch, Direction, ProductPatch, Repo } from '@/lib/data/repo';
import type { Channel, ChannelVisibility, Product, Role } from '@/lib/data/types';
import { reachesAsStaff } from './access';
import { spaceNames } from './feed';
import { authorOf } from './present';

/** Name of the channel every new community starts with. */
export const DEFAULT_CHANNEL = 'General';

export type StaffTick = {
  profileId: string;
  name: string;
  role: Role;
  ticked: boolean;
};
export type StudioCommunity = {
  community: Product;
  channels: Channel[];
  staff: StaffTick[];
  canManageStaff: boolean;
};

const tickable = (role: Role): boolean => !ALWAYS_REACH.includes(role);

export async function studioCommunities(repo: Repo, viewer: Viewer): Promise<Product[] | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const communities = (await repo.products(viewer.space.id)).filter((p) => p.kind === 'community');
  const reached = await Promise.all(communities.map((c) => reachesAsStaff(repo, viewer, c.id)));
  return communities.filter((_, i) => reached[i]);
}

/** The community if the viewer may edit it, else null. */
async function editable(repo: Repo, viewer: Viewer, communityId: string): Promise<Product | null> {
  const community = await repo.product(communityId);
  if (!community || community.kind !== 'community' || community.spaceId !== viewer.space.id) return null;
  return (await reachesAsStaff(repo, viewer, community.id)) ? community : null;
}

export async function studioCommunity(
  repo: Repo,
  viewer: Viewer,
  communityId: string,
): Promise<StudioCommunity | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const community = await editable(repo, viewer, communityId);
  if (!community) return null;
  const [channels, members, ticked, names] = await Promise.all([
    repo.channels(community.id),
    repo.members(viewer.space.id),
    repo.communityStaff(community.id),
    spaceNames(repo, viewer.space.id),
  ]);
  return {
    community,
    channels,
    staff: members
      .filter((m) => tickable(m.role))
      .map((m) => ({
        profileId: m.profileId,
        name: authorOf(names, m.profileId).name,
        role: m.role,
        ticked: ticked.includes(m.profileId),
      })),
    canManageStaff: viewerCan(viewer, 'staff.manage'),
  };
}

export type StudioCommunityCommand =
  | { op: 'createCommunity'; title: string; slug: string }
  | { op: 'updateCommunity'; communityId: string; patch: ProductPatch }
  | {
      op: 'createChannel';
      communityId: string;
      title: string;
      visibility: ChannelVisibility;
    }
  | { op: 'updateChannel'; channelId: string; patch: ChannelPatch }
  | { op: 'deleteChannel'; channelId: string }
  | { op: 'moveChannel'; channelId: string; direction: Direction }
  | { op: 'setStaff'; communityId: string; profileId: string; on: boolean };

const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

async function communityOfChannel(repo: Repo, channelId: string): Promise<string | null> {
  return (await repo.channel(channelId))?.communityId ?? null;
}

/** Owning community id of each op; null = creates a new one. */
const targetOf = (repo: Repo, c: StudioCommunityCommand): Promise<string | null> | null => {
  switch (c.op) {
    case 'createCommunity':
      return null;
    case 'updateCommunity':
    case 'createChannel':
    case 'setStaff':
      return Promise.resolve(c.communityId);
    case 'updateChannel':
    case 'deleteChannel':
    case 'moveChannel':
      return communityOfChannel(repo, c.channelId);
  }
};

async function run(repo: Repo, viewer: Viewer, me: string, c: StudioCommunityCommand): Promise<string | undefined> {
  switch (c.op) {
    case 'createCommunity': {
      const community = await repo.createProduct({
        spaceId: viewer.space.id,
        kind: 'community',
        slug: c.slug,
        title: c.title,
      });
      await repo.createChannel({
        communityId: community.id,
        title: DEFAULT_CHANNEL,
        visibility: 'public',
      });
      // Ticked staff keep reaching what they create.
      if (viewer.role && tickable(viewer.role)) await repo.setCommunityStaff(community.id, me, true);
      return community.id;
    }
    case 'updateCommunity':
      return void (await repo.updateProduct(c.communityId, c.patch));
    case 'createChannel':
      return (
        await repo.createChannel({
          communityId: c.communityId,
          title: c.title,
          visibility: c.visibility,
        })
      ).id;
    case 'updateChannel':
      return void (await repo.updateChannel(c.channelId, c.patch));
    case 'deleteChannel': {
      const channel = await repo.channel(c.channelId);
      if (channel && (await repo.channels(channel.communityId)).length <= 1) {
        throw new ConstraintError('a community needs at least one channel');
      }
      return void (await repo.deleteChannel(c.channelId));
    }
    case 'moveChannel':
      return void (await repo.move('channels', c.channelId, c.direction));
    case 'setStaff': {
      const member = (await repo.members(viewer.space.id)).find((m) => m.profileId === c.profileId);
      if (!member || !tickable(member.role))
        throw new ConstraintError('only assistants and support are ticked per community');
      return void (await repo.setCommunityStaff(c.communityId, c.profileId, c.on));
    }
  }
}

export async function editCommunity(repo: Repo, viewer: Viewer, c: StudioCommunityCommand): Promise<CommandResult> {
  if (!viewer.profile || !viewerCan(viewer, 'products.edit')) return FORBIDDEN;
  if (c.op === 'setStaff' && !viewerCan(viewer, 'staff.manage')) return FORBIDDEN;
  const pending = targetOf(repo, c);
  if (pending) {
    const communityId = await pending;
    if (!communityId || !(await editable(repo, viewer, communityId))) return NOT_FOUND;
  }
  try {
    return { ok: true, id: await run(repo, viewer, viewer.profile.id, c) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
