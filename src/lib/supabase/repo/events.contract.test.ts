// Events Supabase repo against the linked project (service client; RLS is covered by the SQL suites).
// Points are awarded by SQL triggers, so entries are created through the repo and totals read back.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConstraintError } from '@/lib/data/errors';
import { createCoreRepo } from './core';
import { createEventsRepo, type EventsRepo } from './events';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

const DAY = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY);

describe.skipIf(!contractEnabled)('events repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let repo: EventsRepo;
  let communityId: string;
  let groupId: string;
  let otherGroupId: string;
  let channelId: string;
  let alice: string;
  let bob: string;

  const newChallenge = (over: Partial<Parameters<EventsRepo['createChallenge']>[0]> = {}) => ({
    communityId,
    accessGroupId: groupId,
    title: 'Week 1',
    description: '',
    prize: null,
    startsAt: at(-1),
    endsAt: at(6),
    showBeforeStart: false,
    createdAt: new Date(),
    ...over,
  });
  const newMeetup = (over: Partial<Parameters<EventsRepo['createMeetup']>[0]> = {}) => ({
    communityId,
    accessGroupId: groupId,
    channelId: null,
    title: 'Call',
    description: '',
    location: 'https://zoom.example/j/1',
    timeZone: 'Europe/Amsterdam',
    startsAt: at(1),
    endsAt: at(2),
    createdAt: new Date(),
    ...over,
  });

  beforeAll(async () => {
    fx = await createContractSpace('events');
    repo = createEventsRepo({ db: async () => fx.admin, admin: () => fx.admin });
    const core = createCoreRepo({ db: async () => fx.admin, admin: () => fx.admin });
    communityId = (await core.createProduct({ spaceId: fx.spaceId, kind: 'community', slug: 'club', title: 'Club' })).id;
    const groups = await fx.admin.from('access_groups').select('id, is_default').eq('community_id', communityId);
    if (groups.error) throw groups.error;
    groupId = groups.data.find((g) => g.is_default)!.id;
    const other = await core.createProduct({ spaceId: fx.spaceId, kind: 'community', slug: 'other', title: 'Other' });
    otherGroupId = (await fx.admin.from('access_groups').select('id').eq('community_id', other.id).single()).data!.id;
    const ch = await fx.admin
      .from('channels')
      .insert({ community_id: communityId, access_group_id: groupId, title: 'general' })
      .select('id')
      .single();
    if (ch.error) throw ch.error;
    channelId = ch.data.id;
    [alice, bob] = await Promise.all([fx.newUser('alice'), fx.newUser('bob')]);
  });

  afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  describe('challenges', () => {
    it('creates with defaults, reads back, updates only named fields', async () => {
      const c = await repo.createChallenge(newChallenge({ title: 'Create', prize: 'Book' }));
      expect(c).toMatchObject({ communityId, accessGroupId: groupId, title: 'Create', prize: 'Book', description: '', showBeforeStart: false });
      expect(await repo.challenge(c.id)).toEqual(c);
      const u = await repo.updateChallenge(c.id, { title: 'Renamed', prize: null, showBeforeStart: true });
      expect(u).toMatchObject({ title: 'Renamed', prize: null, showBeforeStart: true, startsAt: c.startsAt, endsAt: c.endsAt });
      expect(await repo.challenge('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('lists newest start first, scoped to the community', async () => {
      const early = await repo.createChallenge(newChallenge({ title: 'Order early', startsAt: at(-30), endsAt: at(-20) }));
      const late = await repo.createChallenge(newChallenge({ title: 'Order late', startsAt: at(20), endsAt: at(30) }));
      const ids = (await repo.challenges(communityId)).map((c) => c.id);
      expect(ids.indexOf(late.id)).toBeLessThan(ids.indexOf(early.id));
      expect(await repo.challenges(otherGroupId)).toEqual([]);
    });

    it('refuses blank title, bad window, foreign group, long description', async () => {
      await expect(repo.createChallenge(newChallenge({ title: '  ' }))).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChallenge(newChallenge({ startsAt: at(1), endsAt: at(1) }))).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChallenge(newChallenge({ accessGroupId: otherGroupId }))).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChallenge(newChallenge({ description: 'x'.repeat(10_001) }))).rejects.toBeInstanceOf(ConstraintError);
      const c = await repo.createChallenge(newChallenge());
      await expect(repo.updateChallenge(c.id, { endsAt: at(-5) })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('delete cascades to entries and their points', async () => {
      const c = await repo.createChallenge(newChallenge({ title: 'Cascade' }));
      await repo.createChallengeEntry({ challengeId: c.id, profileId: alice, body: 'done', createdAt: new Date() });
      await repo.deleteChallenge(c.id);
      expect(await repo.challenge(c.id)).toBeNull();
      expect(await repo.challengeEntries(c.id)).toEqual([]);
      const ledger = await fx.admin.from('points_ledger').select('*').eq('source_key', c.id);
      expect(ledger.data).toEqual([]);
    });
  });

  describe('challenge entries + points', () => {
    it('lists oldest first, one per member, body 1..5000, inside the window', async () => {
      const c = await repo.createChallenge(newChallenge({ title: 'Entries', startsAt: at(-3), endsAt: at(3) }));
      const first = new Date(Date.now() - 2 * DAY);
      const second = new Date(Date.now() - DAY);
      await repo.createChallengeEntry({ challengeId: c.id, profileId: bob, body: 'later', createdAt: second });
      await repo.createChallengeEntry({ challengeId: c.id, profileId: alice, body: 'earlier', createdAt: first });
      expect((await repo.challengeEntries(c.id)).map((e) => e.profileId)).toEqual([alice, bob]);

      const entry = { challengeId: c.id, profileId: alice, createdAt: first };
      await expect(repo.createChallengeEntry({ ...entry, body: 'again' })).rejects.toBeInstanceOf(ConstraintError);
      const c2 = await repo.createChallenge(newChallenge({ title: 'Entries 2' }));
      const e2 = { challengeId: c2.id, profileId: alice, createdAt: new Date() };
      await expect(repo.createChallengeEntry({ ...e2, body: ' ' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChallengeEntry({ ...e2, body: 'x'.repeat(5_001) })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChallengeEntry({ ...e2, body: 'x', createdAt: at(30) })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChallengeEntry({ ...e2, createdAt: at(-30), body: 'x' })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('deleting an entry is idempotent and withdraws the points', async () => {
      const c = await repo.createChallenge(newChallenge({ title: 'Withdraw' }));
      await repo.createChallengeEntry({ challengeId: c.id, profileId: bob, body: 'x', createdAt: new Date() });
      const before = (await repo.pointTotals(communityId, null)).find((t) => t.profileId === bob)?.points ?? 0;
      await repo.deleteChallengeEntry(c.id, bob);
      await repo.deleteChallengeEntry(c.id, bob);
      const after = (await repo.pointTotals(communityId, null)).find((t) => t.profileId === bob)?.points ?? 0;
      expect(before - after).toBe(100);
    });

    it('an entry awards 100 points (default), shown in totals by window, highest first', async () => {
      const space2 = await createContractSpace('events-pts');
      try {
        const core = createCoreRepo({ db: async () => space2.admin, admin: () => space2.admin });
        const p = await core.createProduct({ spaceId: space2.spaceId, kind: 'community', slug: 'pts', title: 'Pts' });
        const g = (await space2.admin.from('access_groups').select('id').eq('community_id', p.id).single()).data!.id;
        const r = createEventsRepo({ db: async () => space2.admin, admin: () => space2.admin });
        const [x, y] = await Promise.all([space2.newUser('x'), space2.newUser('y')]);
        const mk = (title: string) =>
          r.createChallenge({
            communityId: p.id, accessGroupId: g, title, description: '', prize: null,
            startsAt: at(-60), endsAt: at(1), showBeforeStart: false, createdAt: new Date(),
          });
        const [c1, c2] = [await mk('old'), await mk('new')];
        // x: old entry (45d ago) + recent entry; y: recent entry only.
        await r.createChallengeEntry({ challengeId: c1.id, profileId: x, body: 'a', createdAt: at(-45) });
        await r.createChallengeEntry({ challengeId: c2.id, profileId: x, body: 'b', createdAt: at(-3) });
        await r.createChallengeEntry({ challengeId: c2.id, profileId: y, body: 'c', createdAt: at(-2) });
        const [first, second] = [x, y].toSorted();
        expect(await r.pointTotals(p.id, null)).toEqual([
          { profileId: x, points: 200 },
          { profileId: y, points: 100 },
        ]);
        expect(await r.pointTotals(p.id, at(-30))).toEqual([first, second].map((id) => ({ profileId: id, points: 100 })));
        expect(await r.pointTotals(p.id, at(-7))).toHaveLength(2);
        expect(await r.pointTotals(p.id, at(-1))).toEqual([]);
        expect(await r.pointTotals(otherGroupId, null)).toEqual([]);
      } finally {
        await space2.cleanup();
      }
    });

    it('awards nothing while points are off', async () => {
      const space3 = await createContractSpace('events-off');
      try {
        const core = createCoreRepo({ db: async () => space3.admin, admin: () => space3.admin });
        const p = await core.createProduct({ spaceId: space3.spaceId, kind: 'community', slug: 'off', title: 'Off' });
        const g = (await space3.admin.from('access_groups').select('id').eq('community_id', p.id).single()).data!.id;
        const s = await space3.admin.from('community_settings').upsert({ community_id: p.id, points_enabled: false });
        if (s.error) throw s.error;
        const r = createEventsRepo({ db: async () => space3.admin, admin: () => space3.admin });
        const u = await space3.newUser('u');
        const c = await r.createChallenge({
          communityId: p.id, accessGroupId: g, title: 't', description: '', prize: null,
          startsAt: at(-1), endsAt: at(1), showBeforeStart: false, createdAt: new Date(),
        });
        await r.createChallengeEntry({ challengeId: c.id, profileId: u, body: 'x', createdAt: new Date() });
        expect(await r.pointTotals(p.id, null)).toEqual([]);
      } finally {
        await space3.cleanup();
      }
    });
  });

  describe('meetups', () => {
    it('creates with defaults (no replay), reads back with the join link', async () => {
      const m = await repo.createMeetup(newMeetup({ title: 'Create', channelId }));
      expect(m).toMatchObject({ communityId, channelId, location: 'https://zoom.example/j/1', timeZone: 'Europe/Amsterdam', replayVimeoId: null });
      expect(await repo.meetup(m.id)).toEqual(m);
      expect(await repo.meetup('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('lists soonest start first; updates only named fields, incl. replay and clearing channel', async () => {
      const late = await repo.createMeetup(newMeetup({ title: 'late', startsAt: at(40), endsAt: at(41) }));
      const soon = await repo.createMeetup(newMeetup({ title: 'soon', startsAt: at(30), endsAt: at(31), channelId }));
      const ids = (await repo.meetups(communityId)).map((m) => m.id);
      expect(ids.indexOf(soon.id)).toBeLessThan(ids.indexOf(late.id));
      const u = await repo.updateMeetup(soon.id, { replayVimeoId: '12345', channelId: null, location: 'https://meet.example/x' });
      expect(u).toMatchObject({ replayVimeoId: '12345', channelId: null, location: 'https://meet.example/x', title: 'soon', startsAt: soon.startsAt });
      expect((await repo.updateMeetup(soon.id, { replayVimeoId: null })).replayVimeoId).toBeNull();
    });

    it('refuses blank title, non-https link, bad window, bad zone, foreign group, bad replay id', async () => {
      const bad = (over: Parameters<typeof newMeetup>[0]) => expect(repo.createMeetup(newMeetup(over))).rejects.toBeInstanceOf(ConstraintError);
      await bad({ title: ' ' });
      await bad({ location: 'http://zoom.example' });
      await bad({ location: 'https://a b' });
      await bad({ startsAt: at(2), endsAt: at(1) });
      await bad({ timeZone: 'Mars/Base' });
      await bad({ accessGroupId: otherGroupId });
      const m = await repo.createMeetup(newMeetup());
      await expect(repo.updateMeetup(m.id, { replayVimeoId: 'abc' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.updateMeetup(m.id, { endsAt: at(-5) })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('refuses a channel of another community', async () => {
      const ch = await fx.admin
        .from('channels')
        .insert({ community_id: (await fx.admin.from('access_groups').select('community_id').eq('id', otherGroupId).single()).data!.community_id, access_group_id: otherGroupId, title: 'x' })
        .select('id')
        .single();
      if (ch.error) throw ch.error;
      await expect(repo.createMeetup(newMeetup({ channelId: ch.data.id }))).rejects.toBeInstanceOf(ConstraintError);
    });

    it('RSVP is idempotent both ways (first timestamp kept); delete cascades', async () => {
      const m = await repo.createMeetup(newMeetup({ title: 'Rsvp' }));
      const t1 = new Date(Date.now() - 5000);
      await repo.setRsvp(m.id, alice, true, t1);
      await repo.setRsvp(m.id, alice, true, new Date());
      await repo.setRsvp(m.id, bob, true, new Date());
      const rsvps = await repo.meetupRsvps(m.id);
      expect(rsvps).toHaveLength(2);
      expect(rsvps.find((r) => r.profileId === alice)?.createdAt.getTime()).toBe(t1.getTime());
      await repo.setRsvp(m.id, bob, false, new Date());
      await repo.setRsvp(m.id, bob, false, new Date());
      expect((await repo.meetupRsvps(m.id)).map((r) => r.profileId)).toEqual([alice]);
      await repo.deleteMeetup(m.id);
      expect(await repo.meetup(m.id)).toBeNull();
      expect(await repo.meetupRsvps(m.id)).toEqual([]);
    });
  });
});
