import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { editCommunity, studioCommunities, studioCommunity, type StudioCommunityCommand } from './studio';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;
const run = async (who: string | null, cmd: StudioCommunityCommand, space = 'alexander') =>
  editCommunity(repo, await as(who, space), cmd, NOW);
const createdId = (r: Awaited<ReturnType<typeof run>>): string => {
  if (!r.ok || !r.id) throw new Error(`expected created id, got ${JSON.stringify(r)}`);
  return r.id;
};
const OWNER = SEED_IDS.alexanderOwner;
const FEED = { kind: 'feed', privacy: 'public', readOnly: false } as const;

describe('studioCommunities', () => {
  it('lists communities the editor reaches; null without products.edit', async () => {
    expect((await studioCommunities(repo, await as(SEED_IDS.alexanderOwner)))?.map((c) => c.id)).toEqual([SEED_IDS.community]);
    expect(await studioCommunities(repo, await as(SEED_IDS.assistant))).toEqual([]);
    await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, true);
    expect((await studioCommunities(repo, await as(SEED_IDS.assistant)))?.length).toBe(1);
    expect(await studioCommunities(repo, await as(SEED_IDS.student))).toBeNull();
  });
});

describe('studioCommunity', () => {
  it('returns channels and the tickable staff', async () => {
    const view = await studioCommunity(repo, await as(SEED_IDS.alexanderOwner), SEED_IDS.community, NOW);
    expect(view?.channels.map((c) => c.title)).toEqual(['General', 'Announcements', 'Lounge']);
    expect(view?.groups.map((g) => g.title)).toEqual(['Members']);
    expect(view?.settings).toEqual({ communityId: SEED_IDS.community, dmsEnabled: true, founderDms: true });
    expect(view?.members).toEqual([
      { id: SEED_IDS.alexanderOwner, name: expect.any(String), staff: true },
      { id: SEED_IDS.student, name: 'Robin (student)', staff: false },
    ]);
    expect(view?.channelMembers).toEqual({});
    expect(view?.canManageStaff).toBe(true);
    expect(view?.staff).toEqual([{ profileId: SEED_IDS.assistant, name: 'Sam (assistant)', role: 'assistant', ticked: false }]);
  });

  it('is null for programs, other spaces and staff who do not reach it', async () => {
    expect(await studioCommunity(repo, await as(SEED_IDS.alexanderOwner), SEED_IDS.program, NOW)).toBeNull();
    expect(await studioCommunity(repo, await as(SEED_IDS.natashaOwner, 'natasha'), SEED_IDS.community, NOW)).toBeNull();
    expect(await studioCommunity(repo, await as(SEED_IDS.assistant), SEED_IDS.community, NOW)).toBeNull();
  });
});

describe('editCommunity', () => {
  it('creates a draft community with a General channel; assistants get ticked', async () => {
    await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, true);
    const r = await run(SEED_IDS.assistant, { op: 'createCommunity', title: 'Circle', slug: 'circle' });
    if (!r.ok || !r.id) throw new Error('expected id');
    expect(await repo.product(r.id)).toMatchObject({ kind: 'community', status: 'draft' });
    const [general] = await repo.channels(r.id);
    const [group] = await repo.accessGroups(r.id);
    expect(general).toMatchObject({ title: 'General', accessGroupId: group?.id, kind: 'feed', privacy: 'public', readOnly: false });
    expect(await repo.communityStaff(r.id)).toEqual([SEED_IDS.assistant]);
  });

  it('manages channels; refuses deleting the last one', async () => {
    const id = createdId(await run(OWNER, { op: 'createChannel', communityId: SEED_IDS.community, title: 'Wins', ...FEED }));
    expect(await repo.channel(id)).toMatchObject({ accessGroupId: SEED_IDS.members, kind: 'feed' });
    expect((await run(OWNER, { op: 'moveChannel', channelId: id, direction: 'up' })).ok).toBe(true);
    expect((await repo.channels(SEED_IDS.community)).map((c) => c.title)).toEqual(['General', 'Announcements', 'Wins', 'Lounge']);
    await run(OWNER, { op: 'updateChannel', channelId: id, patch: { readOnly: true, privacy: 'private' } });
    expect(await repo.channel(id)).toMatchObject({ readOnly: true, privacy: 'private' });
    for (const channelId of [id, SEED_IDS.announcements, SEED_IDS.lounge]) await run(OWNER, { op: 'deleteChannel', channelId });
    expect(await run(OWNER, { op: 'deleteChannel', channelId: SEED_IDS.general })).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('creates channels in a chosen group of the same community only', async () => {
    const vip = createdId(await run(OWNER, { op: 'createGroup', communityId: SEED_IDS.community, title: 'VIP' }));
    const chat = { op: 'createChannel', communityId: SEED_IDS.community, title: 'VIP chat', kind: 'chat', privacy: 'public', readOnly: false } as const;
    const id = createdId(await run(OWNER, { ...chat, accessGroupId: vip }));
    expect(await repo.channel(id)).toMatchObject({ accessGroupId: vip, kind: 'chat' });
    const other = await repo.createProduct({ spaceId: SEED_IDS.alexander, kind: 'community', slug: 'o', title: 'O' });
    const [otherGroup] = await repo.accessGroups(other.id);
    expect(await run(OWNER, { ...chat, accessGroupId: otherGroup!.id })).toMatchObject({ error: 'invalid' });
  });

  it('manages access groups; the default and used groups stay', async () => {
    const vip = createdId(await run(OWNER, { op: 'createGroup', communityId: SEED_IDS.community, title: 'VIP' }));
    expect((await run(OWNER, { op: 'updateGroup', groupId: vip, patch: { title: 'Inner', dms: false } })).ok).toBe(true);
    expect(await repo.accessGroup(vip)).toMatchObject({ title: 'Inner', dms: false, directory: true });
    expect(await run(OWNER, { op: 'deleteGroup', groupId: SEED_IDS.members })).toMatchObject({ error: 'invalid' });
    expect((await run(OWNER, { op: 'deleteGroup', groupId: vip })).ok).toBe(true);
    expect(await run(SEED_IDS.natashaOwner, { op: 'deleteGroup', groupId: SEED_IDS.members }, 'natasha')).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('adds members of the community to private channels only', async () => {
    const add = { op: 'setChannelMember', channelId: SEED_IDS.general, profileId: SEED_IDS.student, on: true } as const;
    expect(await run(OWNER, add)).toMatchObject({ error: 'invalid' });
    await repo.updateChannel(SEED_IDS.general, { privacy: 'private' });
    expect((await run(OWNER, add)).ok).toBe(true);
    expect(await repo.channelMembers(SEED_IDS.general)).toEqual([SEED_IDS.student]);
    expect(await run(OWNER, { ...add, profileId: SEED_IDS.assistant })).toMatchObject({ error: 'invalid' });
    const view = await studioCommunity(repo, await as(OWNER), SEED_IDS.community, NOW);
    expect(view?.channelMembers).toEqual({ [SEED_IDS.general]: [SEED_IDS.student] });
  });

  it('saves DM settings', async () => {
    expect((await run(OWNER, { op: 'saveSettings', communityId: SEED_IDS.community, dmsEnabled: false, founderDms: true })).ok).toBe(true);
    expect(await repo.communitySettings(SEED_IDS.community)).toMatchObject({ dmsEnabled: false });
  });

  it('ticks staff only with staff.manage, only assistant/support', async () => {
    const tick = { op: 'setStaff', communityId: SEED_IDS.community, profileId: SEED_IDS.assistant, on: true } as const;
    await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, true);
    expect(await run(SEED_IDS.assistant, { ...tick, on: false })).toEqual({ ok: false, error: 'forbidden' });
    expect((await run(SEED_IDS.alexanderOwner, { ...tick, on: false })).ok).toBe(true);
    expect(await repo.communityStaff(SEED_IDS.community)).toEqual([]);
    expect(await run(SEED_IDS.alexanderOwner, { ...tick, profileId: SEED_IDS.alexanderOwner })).toMatchObject({ error: 'invalid' });
  });

  it('refuses rows of other spaces and non-editors', async () => {
    const cmd: StudioCommunityCommand = { op: 'updateCommunity', communityId: SEED_IDS.community, patch: { title: 'X' } };
    expect(await run(SEED_IDS.natashaOwner, cmd, 'natasha')).toEqual({ ok: false, error: 'not_found' });
    expect(await run(SEED_IDS.student, cmd)).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(SEED_IDS.assistant, cmd)).toEqual({ ok: false, error: 'not_found' });
    expect((await run(SEED_IDS.alexanderOwner, cmd)).ok).toBe(true);
  });
});
