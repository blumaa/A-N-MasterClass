import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { NewChallenge } from '@/lib/data/repo';
import type { Product } from '@/lib/data/types';
import { communityAccess } from './access';
import { challengeCommand, challengeCsv, challengeList, challengePage } from './challenges';

const NOW = new Date('2026-11-10T12:00:00Z');
const HOUR = 3_600_000;
const at = (h: number) => new Date(NOW.getTime() + h * HOUR);
let repo: FakeRepo;
let community: Product;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  community = (await repo.product(SEED_IDS.community))!;
});

const challenge = (extra: Partial<NewChallenge> = {}) =>
  repo.createChallenge({
    communityId: SEED_IDS.community,
    accessGroupId: SEED_IDS.members,
    title: 'Tie a day',
    description: 'One tie a day.',
    prize: 'Signed rope',
    startsAt: at(-1),
    endsAt: at(24),
    showBeforeStart: false,
    createdAt: NOW,
    ...extra,
  });
const viewer = async (who: string) => (await resolveViewer(repo, 'alexander', who))!;
const ctx = async (who: string) => {
  const v = await viewer(who);
  return { v, access: await communityAccess(repo, v, community, NOW) };
};
const list = async (who: string, now = NOW) => {
  const { v, access } = await ctx(who);
  return challengeList(repo, v, community, access, now);
};
const enter = async (who: string, challengeId: string, body = 'Done', now = NOW) =>
  challengeCommand(repo, await viewer(who), { op: 'enter', challengeId, body }, now);

describe('challengeList', () => {
  it('shows members the started challenges of their groups, upcoming only when allowed', async () => {
    const open = await challenge();
    await challenge({ title: 'Hidden', startsAt: at(2), endsAt: at(5) });
    const teased = await challenge({ title: 'Soon', startsAt: at(2), endsAt: at(5), showBeforeStart: true });
    const ended = await challenge({ title: 'Old', startsAt: at(-10), endsAt: at(-5) });
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    await challenge({ title: 'VIP only', accessGroupId: vip.id });
    const items = await list(SEED_IDS.student);
    expect(items?.map((c) => [c.id, c.state])).toEqual([
      [teased.id, 'upcoming'],
      [open.id, 'open'],
      [ended.id, 'ended'],
    ]);
    expect(await list(SEED_IDS.alexanderOwner)).toHaveLength(5);
  });

  it('is null when the group has challenges off or the viewer cannot read', async () => {
    await repo.updateAccessGroup(SEED_IDS.members, { challenges: false });
    expect(await list(SEED_IDS.student)).toBeNull();
    expect(await list(SEED_IDS.assistant)).toBeNull();
  });

  it('marks the entry count and the viewer entry', async () => {
    const c = await challenge();
    expect((await enter(SEED_IDS.student, c.id)).ok).toBe(true);
    const [item] = (await list(SEED_IDS.student))!;
    expect(item.entryCount).toBe(1);
    expect(item.mine).toEqual({ body: 'Done', createdAt: NOW });
  });
});

describe('challengeCommand', () => {
  it('takes one entry inside the window and allows withdrawing while open', async () => {
    const c = await challenge();
    expect(await enter(SEED_IDS.student, c.id, ' ')).toMatchObject({ ok: false, error: 'invalid' });
    expect((await enter(SEED_IDS.student, c.id)).ok).toBe(true);
    expect(await enter(SEED_IDS.student, c.id)).toMatchObject({ ok: false, error: 'invalid' });
    expect(await enter(SEED_IDS.student, c.id, 'Late', at(25))).toMatchObject({ ok: false, error: 'invalid' });
    const student = await viewer(SEED_IDS.student);
    expect(await challengeCommand(repo, student, { op: 'withdraw', challengeId: c.id }, at(25))).toMatchObject({ ok: false });
    expect(await challengeCommand(repo, student, { op: 'withdraw', challengeId: c.id }, NOW)).toEqual({ ok: true });
    expect(await repo.challengeEntries(c.id)).toEqual([]);
  });

  it('refuses challenges the viewer cannot see', async () => {
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    const c = await challenge({ accessGroupId: vip.id });
    expect(await enter(SEED_IDS.student, c.id)).toEqual({ ok: false, error: 'not_found' });
    expect(await enter(SEED_IDS.student, 'nope')).toEqual({ ok: false, error: 'not_found' });
    const soon = await challenge({ startsAt: at(1), endsAt: at(2), showBeforeStart: true });
    expect(await enter(SEED_IDS.student, soon.id)).toMatchObject({ ok: false, error: 'invalid' });
  });
});

describe('challengePage', () => {
  it('gives staff every entry with names; members only their own', async () => {
    const c = await challenge();
    await enter(SEED_IDS.student, c.id, 'My tie');
    const owner = await ctx(SEED_IDS.alexanderOwner);
    const page = await challengePage(repo, owner.v, community, owner.access, c.id, NOW);
    expect(page?.entries).toEqual([{ author: { id: SEED_IDS.student, name: 'Robin (student)' }, body: 'My tie', createdAt: NOW }]);
    const student = await ctx(SEED_IDS.student);
    const own = await challengePage(repo, student.v, community, student.access, c.id, NOW);
    expect(own?.entries).toBeNull();
    expect(own?.challenge.mine?.body).toBe('My tie');
  });
});

describe('challengeCsv', () => {
  it('quotes fields and guards against spreadsheet formulas', () => {
    const csv = challengeCsv([
      { author: { id: 'u1', name: 'Robin, "R"' }, body: '=SUM(A1)\nline', createdAt: NOW },
    ]);
    expect(csv).toBe('name,submitted_at,entry\r\n"Robin, ""R""",2026-11-10T12:00:00.000Z,"\'=SUM(A1)\nline"\r\n');
  });
});
