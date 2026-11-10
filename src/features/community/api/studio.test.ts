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
  editCommunity(repo, await as(who, space), cmd);

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
    const view = await studioCommunity(repo, await as(SEED_IDS.alexanderOwner), SEED_IDS.community);
    expect(view?.channels.map((c) => c.title)).toEqual(['General', 'Announcements']);
    expect(view?.canManageStaff).toBe(true);
    expect(view?.staff).toEqual([{ profileId: SEED_IDS.assistant, name: 'Sam (assistant)', role: 'assistant', ticked: false }]);
  });

  it('is null for programs, other spaces and staff who do not reach it', async () => {
    expect(await studioCommunity(repo, await as(SEED_IDS.alexanderOwner), SEED_IDS.program)).toBeNull();
    expect(await studioCommunity(repo, await as(SEED_IDS.natashaOwner, 'natasha'), SEED_IDS.community)).toBeNull();
    expect(await studioCommunity(repo, await as(SEED_IDS.assistant), SEED_IDS.community)).toBeNull();
  });
});

describe('editCommunity', () => {
  it('creates a draft community with a General channel; assistants get ticked', async () => {
    await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, true);
    const r = await run(SEED_IDS.assistant, { op: 'createCommunity', title: 'Circle', slug: 'circle' });
    if (!r.ok || !r.id) throw new Error('expected id');
    expect(await repo.product(r.id)).toMatchObject({ kind: 'community', status: 'draft' });
    expect((await repo.channels(r.id)).map((c) => c.title)).toEqual(['General']);
    expect(await repo.communityStaff(r.id)).toEqual([SEED_IDS.assistant]);
  });

  it('manages channels; refuses deleting the last one', async () => {
    const created = await run(SEED_IDS.alexanderOwner, {
      op: 'createChannel',
      communityId: SEED_IDS.community,
      title: 'Wins',
      visibility: 'public',
    });
    if (!created.ok || !created.id) throw new Error('expected id');
    expect((await run(SEED_IDS.alexanderOwner, { op: 'moveChannel', channelId: created.id, direction: 'up' })).ok).toBe(true);
    expect((await repo.channels(SEED_IDS.community)).map((c) => c.title)).toEqual(['General', 'Wins', 'Announcements']);
    await run(SEED_IDS.alexanderOwner, { op: 'updateChannel', channelId: created.id, patch: { visibility: 'read_only' } });
    expect((await repo.channel(created.id))?.visibility).toBe('read_only');
    await run(SEED_IDS.alexanderOwner, { op: 'deleteChannel', channelId: created.id });
    await run(SEED_IDS.alexanderOwner, { op: 'deleteChannel', channelId: SEED_IDS.announcements });
    expect(await run(SEED_IDS.alexanderOwner, { op: 'deleteChannel', channelId: SEED_IDS.general })).toMatchObject({
      ok: false,
      error: 'invalid',
    });
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
