import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { NewMeetup } from '@/lib/data/repo';
import type { Product } from '@/lib/data/types';
import { communityAccess } from './access';
import { meetupCommand, meetupIcs, meetupItem, meetupList } from './meetups';

const NOW = new Date('2026-11-10T12:00:00Z');
const MIN = 60_000;
const at = (m: number) => new Date(NOW.getTime() + m * MIN);
let repo: FakeRepo;
let community: Product;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  community = (await repo.product(SEED_IDS.community))!;
});

const meetup = (extra: Partial<NewMeetup> = {}) =>
  repo.createMeetup({
    communityId: SEED_IDS.community,
    accessGroupId: SEED_IDS.members,
    channelId: null,
    title: 'Live Q&A',
    description: 'Bring questions.',
    location: 'https://zoom.us/j/1',
    timeZone: 'Europe/Berlin',
    startsAt: at(60),
    endsAt: at(120),
    createdAt: NOW,
    ...extra,
  });
const ctx = async (who: string, now = NOW) => {
  const v = (await resolveViewer(repo, 'alexander', who))!;
  return { v, access: await communityAccess(repo, v, community, now) };
};
const list = async (who: string, now = NOW) => {
  const { v, access } = await ctx(who, now);
  return meetupList(repo, v, community, access, now);
};
const item = async (who: string, id: string, now = NOW) => {
  const { v, access } = await ctx(who, now);
  return meetupItem(repo, v, community, access, id, now);
};

describe('meetupList', () => {
  it('splits upcoming (soonest first, live included) from past (newest first), by group', async () => {
    const later = await meetup({ startsAt: at(300), endsAt: at(360) });
    const soon = await meetup();
    const live = await meetup({ startsAt: at(-10), endsAt: at(20) });
    const old = await meetup({ startsAt: at(-600), endsAt: at(-540) });
    const older = await meetup({ startsAt: at(-900), endsAt: at(-840) });
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    await meetup({ accessGroupId: vip.id });
    const r = (await list(SEED_IDS.student))!;
    expect(r.upcoming.map((m) => [m.id, m.state])).toEqual([
      [live.id, 'live'],
      [soon.id, 'upcoming'],
      [later.id, 'upcoming'],
    ]);
    expect(r.past.map((m) => m.id)).toEqual([old.id, older.id]);
    expect((await list(SEED_IDS.alexanderOwner))!.upcoming).toHaveLength(4);
  });

  it('is null when the group has meetups off or the viewer cannot read', async () => {
    await repo.updateAccessGroup(SEED_IDS.members, { meetups: false });
    expect(await list(SEED_IDS.student)).toBeNull();
    expect(await list(SEED_IDS.assistant)).toBeNull();
  });
});

describe('meetupItem', () => {
  it('shows the join link to members from 15 minutes before the start until the end', async () => {
    const m = await meetup();
    expect((await item(SEED_IDS.student, m.id))?.joinUrl).toBeNull();
    expect((await item(SEED_IDS.student, m.id, at(44)))?.joinUrl).toBeNull();
    expect((await item(SEED_IDS.student, m.id, at(45)))?.joinUrl).toBe('https://zoom.us/j/1');
    expect((await item(SEED_IDS.student, m.id, at(121)))?.joinUrl).toBeNull();
    expect((await item(SEED_IDS.alexanderOwner, m.id))?.joinUrl).toBe('https://zoom.us/j/1');
  });

  it('shows the replay only after the end', async () => {
    const m = await meetup();
    await repo.updateMeetup(m.id, { replayVimeoId: '123' });
    expect((await item(SEED_IDS.student, m.id))?.replayVimeoId).toBeNull();
    expect((await item(SEED_IDS.student, m.id, at(121)))?.replayVimeoId).toBe('123');
  });
});

describe('meetupCommand', () => {
  it('toggles the RSVP until the meetup ends', async () => {
    const m = await meetup();
    const student = (await resolveViewer(repo, 'alexander', SEED_IDS.student))!;
    expect(await meetupCommand(repo, student, { op: 'rsvp', meetupId: m.id, on: true }, NOW)).toEqual({ ok: true });
    expect(await item(SEED_IDS.student, m.id)).toMatchObject({ going: true, rsvpCount: 1 });
    expect(await meetupCommand(repo, student, { op: 'rsvp', meetupId: m.id, on: false }, at(121))).toMatchObject({
      ok: false,
      error: 'invalid',
    });
    expect(await meetupCommand(repo, student, { op: 'rsvp', meetupId: 'nope', on: true }, NOW)).toEqual({
      ok: false,
      error: 'not_found',
    });
  });
});

describe('meetupIcs', () => {
  it('points the calendar entry at the meetup page, never the join link', async () => {
    const m = await meetup();
    const { access } = await ctx(SEED_IDS.student);
    const ics = await meetupIcs(repo, community, access, m.id, 'https://a.example/m/1', NOW);
    expect(ics).toContain('LOCATION:https://a.example/m/1');
    expect(ics).toContain(`UID:${m.id}@masterclass`);
    expect(ics).not.toContain('zoom.us');
  });
});
