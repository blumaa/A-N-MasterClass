import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError } from '../errors';
import type { NewChallenge, NewMeetup } from '../repo';
import type { MeetupOccurrence, Repeat } from '../types';
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
    repeat: null,
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
    await repo.setRsvp(soon.id, 0, SEED_IDS.student, true, NOW);
    await repo.setRsvp(soon.id, 0, SEED_IDS.student, true, NOW);
    expect(await repo.meetupRsvps(soon.id)).toEqual([
      { meetupId: soon.id, occurrence: 0, profileId: SEED_IDS.student, createdAt: NOW },
    ]);
    await repo.setRsvp(soon.id, 0, SEED_IDS.student, false, NOW);
    expect(await repo.meetupRsvps(soon.id)).toEqual([]);
    await repo.setRsvp(soon.id, 0, SEED_IDS.student, true, NOW);
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

describe('recurring meetups', () => {
  const weekly = (r: Partial<Repeat> = {}): Repeat => ({ freq: 'weekly', every: 1, days: [], count: 5, until: null, ...r });
  const occurrence = (meetupId: string, n: number, extra: Partial<MeetupOccurrence> = {}): MeetupOccurrence => ({
    meetupId,
    occurrence: n,
    cancelled: false,
    title: null,
    description: null,
    startsAt: null,
    endsAt: null,
    replayVimeoId: null,
    ...extra,
  });

  it('checks the repeat rules', async () => {
    await expect(newMeetup({ repeat: weekly({ every: 0 }) })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ repeat: weekly({ every: 100 }) })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ repeat: weekly({ count: 0 }) })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ repeat: weekly({ until: '2027-01-01' }) })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ repeat: weekly({ days: [8] }) })).rejects.toThrow(ConstraintError);
    await expect(newMeetup({ repeat: weekly({ freq: 'daily', days: [1] }) })).rejects.toThrow(ConstraintError);
    expect((await newMeetup({ repeat: weekly({ days: [1, 3] }) })).repeat).toEqual(weekly({ days: [1, 3] }));
  });

  it('edits and cancels one occurrence; cancelling drops its RSVPs', async () => {
    const m = await newMeetup({ repeat: weekly() });
    await expect(repo.setMeetupOccurrence(occurrence(m.id, 5, { title: 'x' }))).rejects.toThrow(ConstraintError);
    await expect(repo.setMeetupOccurrence(occurrence(m.id, 1, { title: ' ' }))).rejects.toThrow(ConstraintError);
    await expect(repo.setMeetupOccurrence(occurrence(m.id, 1, { startsAt: at(5) }))).rejects.toThrow(ConstraintError);
    await repo.setMeetupOccurrence(occurrence(m.id, 1, { title: 'Special' }));
    await repo.setRsvp(m.id, 2, SEED_IDS.student, true, NOW);
    await repo.setRsvp(m.id, 3, SEED_IDS.student, true, NOW);
    await repo.setMeetupOccurrence(occurrence(m.id, 2, { cancelled: true }));
    expect((await repo.meetupRsvps(m.id)).map((r) => r.occurrence)).toEqual([3]);
    expect((await repo.meetupOccurrences(m.id)).map((o) => [o.occurrence, o.title, o.cancelled])).toEqual([
      [1, 'Special', false],
      [2, null, true],
    ]);
    await expect(repo.setRsvp(m.id, 7, SEED_IDS.student, true, NOW)).rejects.toThrow();
  });

  it('a shorter series drops edits and RSVPs past its end; delete drops edits', async () => {
    const m = await newMeetup({ repeat: weekly() });
    await repo.setMeetupOccurrence(occurrence(m.id, 4, { title: 'Last' }));
    await repo.setRsvp(m.id, 3, SEED_IDS.student, true, NOW);
    await repo.updateMeetup(m.id, { repeat: weekly({ count: 3 }) });
    expect(await repo.meetupOccurrences(m.id)).toEqual([]);
    expect(await repo.meetupRsvps(m.id)).toEqual([]);
    await repo.setMeetupOccurrence(occurrence(m.id, 1, { title: 'x' }));
    await repo.deleteMeetup(m.id);
    expect(repo.db.meetupOccurrences).toEqual([]);
  });

  it('splits a series: the new one takes over from the split occurrence, renumbered', async () => {
    const m = await newMeetup({ repeat: weekly({ days: [1] }) });
    await repo.setMeetupOccurrence(occurrence(m.id, 3, { cancelled: true }));
    await repo.setRsvp(m.id, 1, SEED_IDS.student, true, NOW);
    await repo.setRsvp(m.id, 2, SEED_IDS.student, true, NOW);
    await expect(repo.splitMeetup(m.id, 0)).rejects.toThrow(ConstraintError);
    await expect(repo.splitMeetup(m.id, 5)).rejects.toThrow(ConstraintError);
    const next = await repo.splitMeetup(m.id, 2);
    // NOW is a Tuesday: weekly on Tuesday + Monday, so occurrence 2 is the Tuesday a week later.
    expect(next.startsAt).toEqual(at(2 + 7 * 24));
    expect(next.repeat).toEqual(weekly({ days: [1, 2], count: 3 }));
    expect((await repo.meetup(m.id))?.repeat?.count).toBe(2);
    expect((await repo.meetupRsvps(m.id)).map((r) => r.occurrence)).toEqual([1]);
    expect((await repo.meetupRsvps(next.id)).map((r) => r.occurrence)).toEqual([0]);
    expect((await repo.meetupOccurrences(next.id)).map((o) => o.occurrence)).toEqual([1]);
  });
});
