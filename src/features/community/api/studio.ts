// Studio for communities: reads + one command entry point. Same shape as studio curriculum:
// capability check (G15), then the owning community must be in the viewer's space and reached
// by the viewer (assistant/support only when ticked), then the write.
import { ALWAYS_REACH } from '@/lib/auth/capabilities';
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { AccessGroupPatch, ChannelPatch, CommunitySettingsPatch, Direction, ProductPatch, Repo } from '@/lib/data/repo';
import type { AccessGroup, Channel, ChannelKind, ChannelPrivacy, CommunitySettings, Product, Role } from '@/lib/data/types';
import { reachesAsStaff } from './access';
import { directory, spaceNames, type DirectoryEntry } from './feed';
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
  groups: AccessGroup[];
  settings: CommunitySettings;
  /** Everyone in the community (private channel member picker). */
  members: DirectoryEntry[];
  /** Picked members per private channel. */
  channelMembers: Record<string, string[]>;
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
export async function editable(repo: Repo, viewer: Viewer, communityId: string): Promise<Product | null> {
  const community = await repo.product(communityId);
  if (!community || community.kind !== 'community' || community.spaceId !== viewer.space.id) return null;
  return (await reachesAsStaff(repo, viewer, community.id)) ? community : null;
}

export async function studioCommunity(
  repo: Repo,
  viewer: Viewer,
  communityId: string,
  now: Date,
): Promise<StudioCommunity | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const community = await editable(repo, viewer, communityId);
  if (!community) return null;
  const [channels, members, ticked, names, groups, settings, people] = await Promise.all([
    repo.channels(community.id),
    repo.members(viewer.space.id),
    repo.communityStaff(community.id),
    spaceNames(repo, viewer.space.id),
    repo.accessGroups(community.id),
    repo.communitySettings(community.id),
    directory(repo, community, now),
  ]);
  const privates = channels.filter((c) => c.privacy === 'private');
  const picked = await Promise.all(privates.map((c) => repo.channelMembers(c.id)));
  return {
    community,
    channels,
    groups,
    settings,
    members: people,
    channelMembers: Object.fromEntries(privates.map((c, i) => [c.id, picked[i] ?? []])),
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
      kind: ChannelKind;
      privacy: ChannelPrivacy;
      readOnly: boolean;
      /** Default group when absent. */
      accessGroupId?: string;
    }
  | { op: 'updateChannel'; channelId: string; patch: ChannelPatch }
  | { op: 'deleteChannel'; channelId: string }
  | { op: 'moveChannel'; channelId: string; direction: Direction }
  | { op: 'setChannelMember'; channelId: string; profileId: string; on: boolean }
  | { op: 'createGroup'; communityId: string; title: string }
  | { op: 'updateGroup'; groupId: string; patch: AccessGroupPatch }
  | { op: 'deleteGroup'; groupId: string }
  | { op: 'saveSettings'; communityId: string; patch: CommunitySettingsPatch }
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
    case 'createGroup':
    case 'saveSettings':
    case 'setStaff':
      return Promise.resolve(c.communityId);
    case 'updateChannel':
    case 'deleteChannel':
    case 'moveChannel':
    case 'setChannelMember':
      return communityOfChannel(repo, c.channelId);
    case 'updateGroup':
    case 'deleteGroup':
      return repo.accessGroup(c.groupId).then((g) => g?.communityId ?? null);
  }
};

async function saveSettings(repo: Repo, communityId: string, patch: CommunitySettingsPatch): Promise<void> {
  const current = await repo.communitySettings(communityId);
  const pointValues = { ...current.pointValues, ...patch.pointValues };
  await repo.saveCommunitySettings({ ...current, ...patch, communityId, pointValues });
}

async function defaultGroup(repo: Repo, communityId: string): Promise<string> {
  const group = (await repo.accessGroups(communityId)).find((g) => g.isDefault);
  if (!group) throw new ConstraintError('community has no default group');
  return group.id;
}

async function setChannelMember(repo: Repo, c: Extract<StudioCommunityCommand, { op: 'setChannelMember' }>, now: Date) {
  const channel = await repo.channel(c.channelId);
  const community = channel && (await repo.product(channel.communityId));
  if (!channel || !community) throw new ConstraintError('channel not found');
  if (channel.privacy !== 'private') throw new ConstraintError('only private channels have picked members');
  if (c.on && !(await directory(repo, community, now)).some((m) => m.id === c.profileId)) {
    throw new ConstraintError('not a member of this community');
  }
  await repo.setChannelMember(c.channelId, c.profileId, c.on);
}

type Ctx = { repo: Repo; viewer: Viewer; me: string; now: Date };

async function run({ repo, viewer, me, now }: Ctx, c: StudioCommunityCommand): Promise<string | undefined> {
  switch (c.op) {
    case 'createCommunity': {
      const community = await repo.createProduct({
        spaceId: viewer.space.id,
        kind: 'community',
        slug: c.slug,
        title: c.title,
      });
      // The default access group comes with the product (repo / DB trigger).
      await repo.createChannel({
        communityId: community.id,
        accessGroupId: await defaultGroup(repo, community.id),
        title: DEFAULT_CHANNEL,
        kind: 'feed',
        privacy: 'public',
        readOnly: false,
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
          accessGroupId: c.accessGroupId ?? (await defaultGroup(repo, c.communityId)),
          title: c.title,
          kind: c.kind,
          privacy: c.privacy,
          readOnly: c.readOnly,
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
    case 'setChannelMember':
      return void (await setChannelMember(repo, c, now));
    case 'createGroup':
      return (await repo.createAccessGroup({ communityId: c.communityId, title: c.title })).id;
    case 'updateGroup':
      return void (await repo.updateAccessGroup(c.groupId, c.patch));
    case 'deleteGroup':
      return void (await repo.deleteAccessGroup(c.groupId));
    case 'saveSettings':
      return void (await saveSettings(repo, c.communityId, c.patch));
    case 'setStaff': {
      const member = (await repo.members(viewer.space.id)).find((m) => m.profileId === c.profileId);
      if (!member || !tickable(member.role))
        throw new ConstraintError('only assistants and support are ticked per community');
      return void (await repo.setCommunityStaff(c.communityId, c.profileId, c.on));
    }
  }
}

export async function editCommunity(
  repo: Repo,
  viewer: Viewer,
  c: StudioCommunityCommand,
  now: Date,
): Promise<CommandResult> {
  if (!viewer.profile || !viewerCan(viewer, 'products.edit')) return FORBIDDEN;
  if (c.op === 'setStaff' && !viewerCan(viewer, 'staff.manage')) return FORBIDDEN;
  const pending = targetOf(repo, c);
  if (pending) {
    const communityId = await pending;
    if (!communityId || !(await editable(repo, viewer, communityId))) return NOT_FOUND;
  }
  try {
    return { ok: true, id: await run({ repo, viewer, me: viewer.profile.id, now }, c) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
