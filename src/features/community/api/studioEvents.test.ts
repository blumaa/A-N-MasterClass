import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { editEvents, studioEvents, studioMeetup, type EventsCommand } from './studioEvents';

const NOW = new Date('2026-11-10T12:00:00Z');
const HOUR = 3_600_000;
const at = (h: number) => new Date(NOW.getTime() + h * HOUR);
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (who: string) => (await resolveViewer(repo, 'alexander', who))!;
const run = async (who: string, cmd: EventsCommand) => editEvents(repo, await as(who), cmd, NOW);
const OWNER = SEED_IDS.alexanderOwner;
const CHALLENGE = {
  op: 'createChallenge',
  communityId: SEED_IDS.community,
  accessGroupId: SEED_IDS.members,
  title: 'Tie a day',
  description: '',
  prize: null,
  startsAt: at(1),
  endsAt: at(48),
  showBeforeStart: true,
} as const;
const MEETUP = {
  op: 'createMeetup',
  communityId: SEED_IDS.community,
  accessGroupId: SEED_IDS.members,
  channelId: null,
  title: 'Q&A',
  description: '',
  location: 'https://zoom.us/j/1',
  timeZone: 'Europe/Berlin',
  startsAt: at(24),
  endsAt: at(25),
  repeat: null,
} as const;
const idOf = (r: Awaited<ReturnType<typeof run>>): string => {
  if (!r.ok || !r.id) throw new Error(`expected id, got ${JSON.stringify(r)}`);
  return r.id;
};

describe('editEvents', () => {
  it('creates, updates and deletes challenges', async () => {
    const id = idOf(await run(OWNER, CHALLENGE));
    expect((await repo.challenge(id))?.createdAt).toEqual(NOW);
    expect(await run(OWNER, { op: 'updateChallenge', challengeId: id, patch: { title: 'Two a day' } })).toEqual({ ok: true });
    expect((await repo.challenge(id))?.title).toBe('Two a day');
    expect(await run(OWNER, { op: 'deleteChallenge', challengeId: id })).toEqual({ ok: true });
    expect(await repo.challenge(id)).toBeNull();
  });

  it('creates, updates and deletes meetups', async () => {
    const id = idOf(await run(OWNER, MEETUP));
    expect(await run(OWNER, { op: 'updateMeetup', meetupId: id, patch: { replayVimeoId: '123' } })).toEqual({ ok: true });
    expect((await repo.meetup(id))?.replayVimeoId).toBe('123');
    expect(await run(OWNER, { op: 'deleteMeetup', meetupId: id })).toEqual({ ok: true });
    expect(await repo.meetup(id)).toBeNull();
  });

  it('maps constraint violations to invalid', async () => {
    expect(await run(OWNER, { ...CHALLENGE, endsAt: at(0) })).toMatchObject({ ok: false, error: 'invalid' });
    expect(await run(OWNER, { ...MEETUP, location: 'http://x' })).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('refuses viewers without products.edit and communities out of reach', async () => {
    expect(await run(SEED_IDS.student, CHALLENGE)).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(SEED_IDS.assistant, CHALLENGE)).toEqual({ ok: false, error: 'not_found' });
    expect(await run(OWNER, { op: 'deleteMeetup', meetupId: 'nope' })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('occurrence ops', () => {
  it('edits and cancels occurrences of a meetup the viewer can edit', async () => {
    const id = idOf(await run(OWNER, { ...MEETUP, repeat: { freq: 'daily', every: 1, days: [], count: 3, until: null } }));
    const edit = { op: 'editOccurrence', meetupId: id, occurrence: 1, scope: 'this', patch: { title: 'Two' } } as const;
    expect(await run(OWNER, edit)).toEqual({ ok: true, id });
    expect(await run(OWNER, { op: 'cancelOccurrence', meetupId: id, occurrence: 2, scope: 'this' })).toEqual({ ok: true, id });
    expect(await run(OWNER, { ...edit, occurrence: 2 })).toMatchObject({ ok: false, error: 'invalid' });
    expect(await run(SEED_IDS.assistant, edit)).toEqual({ ok: false, error: 'not_found' });
    const view = await studioMeetup(repo, await as(OWNER), id, NOW);
    expect(view?.upcoming.map((o) => [o.title, o.cancelled])).toEqual([
      ['Q&A', false],
      ['Two', false],
      ['Q&A', true],
    ]);
    expect(await studioMeetup(repo, await as(SEED_IDS.student), id, NOW)).toBeNull();
  });
});

describe('studioEvents', () => {
  it('lists groups, channels, challenges with entry counts and meetups with RSVP counts', async () => {
    const c = idOf(await run(OWNER, CHALLENGE));
    const m = idOf(await run(OWNER, MEETUP));
    await repo.setRsvp(m, 0, SEED_IDS.student, true, NOW);
    const view = await studioEvents(repo, await as(OWNER), SEED_IDS.community);
    expect(view?.groups.map((g) => g.id)).toContain(SEED_IDS.members);
    expect(view?.channels.length).toBeGreaterThan(0);
    expect(view?.challenges.map((x) => [x.id, x.entryCount])).toEqual([[c, 0]]);
    expect(view?.meetups.map((x) => [x.id, x.rsvpCount])).toEqual([[m, 1]]);
    expect(await studioEvents(repo, await as(SEED_IDS.student), SEED_IDS.community)).toBeNull();
  });
});
