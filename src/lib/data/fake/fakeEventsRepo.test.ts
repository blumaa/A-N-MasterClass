import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError } from '../errors';
import type { NewChallenge, NewMeetup } from '../repo';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-10T12:00:00Z');
const HOUR = 3_600_000;
const at = (h: number) => new Date(NOW.getTime() + h * HOUR);
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const newChallenge = (extra: Partial<NewChallenge> = {}) =>
  repo.createChallenge({
    communityId: SEED_IDS.community,
    accessGroupId: SEED_IDS.members,
    title: '30 days of ties',
    description: 'One tie a day.',
    prize: null,
    startsAt: at(-1),
    endsAt: at(24),
    showBeforeStart: false,
    createdAt: NOW,
    ...extra,
  });

const newMeetup = (extra: Partial<NewMeetup> = {}) =>
  repo.createMeetup({
    communityId: SEED_IDS.community,
    accessGroupId: SEED_IDS.members,
    channelId: null,
    title: 'Q&A',
    description: '',
    location: 'https://zoom.example/j/1',
    timeZone: 'Europe/Berlin',
    startsAt: at(2),
    endsAt: at(3),
    createdAt: NOW,
    ...extra,
  });

describe('challenges', () => {
  it('check title, window and group of the same community', async () => {
    await expect(newChallenge({ title: ' ' })).rejects.toThrow(ConstraintError);
    await expect(newChallenge({ endsAt: at(-1) })).rejects.toThrow(ConstraintError);
    await expect(newChallenge({ accessGroupId: 'nope' })).rejects.toThrow(ConstraintError);
    const c = await newChallenge();
    await expect(repo.updateChallenge(c.id, { endsAt: at(-2) })).rejects.toThrow(ConstraintError);
    expect((await repo.updateChallenge(c.id, { title: 'New' })).title).toBe('New');
  });

  it('lists newest start first', async () => {
    const a = await newChallenge({ startsAt: at(1) });
    const b = await newChallenge({ startsAt: at(5), endsAt: at(30) });
    expect((await repo.challenges(SEED_IDS.community)).map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it('takes one entry per member inside the window; delete cascades', async () => {
    const c = await newChallenge();
    const entry = { challengeId: c.id, profileId: SEED_IDS.student, body: 'Done', createdAt: NOW };
    await expect(repo.createChallengeEntry({ ...entry, createdAt: at(25) })).rejects.toThrow(/window/);
    await expect(repo.createChallengeEntry({ ...entry, body: '' })).rejects.toThrow(ConstraintError);
    await repo.createChallengeEntry(entry);
    await expect(repo.createChallengeEntry(entry)).rejects.toThrow(ConstraintError);
    expect(await repo.challengeEntries(c.id)).toEqual([entry]);
    await repo.deleteChallengeEntry(c.id, SEED_IDS.student);
    expect(await repo.challengeEntries(c.id)).toEqual([]);
    await repo.createChallengeEntry(entry);
    await repo.deleteChallenge(c.id);
    expect(repo.db.challengeEntries).toEqual([]);
    expect(await repo.challenge(c.id)).toBeNull();
  });
});

describe('meetups', () => {
  it('check link, zone, window, group and channel', async () => {
    await expect(newMeetup({ location: 'http://zoom.example' })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ timeZone: 'Mars/Base' })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ endsAt: at(1) })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ channelId: 'nope' })).rejects.toThrow(ConstraintError);
    const m = await newMeetup({ channelId: SEED_IDS.lounge });
    expect(m.replayVimeoId).toBeNull();
    await expect(repo.updateMeetup(m.id, { replayVimeoId: 'abc' })).rejects.toThrow(ConstraintError);
    expect((await repo.updateMeetup(m.id, { replayVimeoId: '123' })).replayVimeoId).toBe('123');
  });

  it('lists soonest first; RSVPs toggle; delete cascades; channel delete unlinks', async () => {
    const late = await newMeetup({ startsAt: at(5), endsAt: at(6), channelId: SEED_IDS.lounge });
    const soon = await newMeetup();
    expect((await repo.meetups(SEED_IDS.community)).map((m) => m.id)).toEqual([soon.id, late.id]);
    await repo.setRsvp(soon.id, SEED_IDS.student, true, NOW);
    await repo.setRsvp(soon.id, SEED_IDS.student, true, NOW);
    expect(await repo.meetupRsvps(soon.id)).toEqual([{ meetupId: soon.id, profileId: SEED_IDS.student, createdAt: NOW }]);
    await repo.setRsvp(soon.id, SEED_IDS.student, false, NOW);
    expect(await repo.meetupRsvps(soon.id)).toEqual([]);
    await repo.setRsvp(soon.id, SEED_IDS.student, true, NOW);
    await repo.deleteMeetup(soon.id);
    expect(repo.db.meetupRsvps).toEqual([]);
    await repo.deleteChannel(SEED_IDS.lounge);
    expect((await repo.meetup(late.id))?.channelId).toBeNull();
  });

  it('keeps groups used by challenges or meetups', async () => {
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    await newMeetup({ accessGroupId: vip.id });
    await expect(repo.deleteAccessGroup(vip.id)).rejects.toThrow(/in use/);
    const gold = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'Gold' });
    await newChallenge({ accessGroupId: gold.id });
    await expect(repo.deleteAccessGroup(gold.id)).rejects.toThrow(/in use/);
  });
});
