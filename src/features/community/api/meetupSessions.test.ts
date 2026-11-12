import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { Meetup } from '@/lib/data/types';
import { zonedToUtc } from '@/lib/format/zoned';
import { meetupSessions, runOccurrenceCommand, type OccurrenceCommand } from './meetupSessions';

const NOW = new Date('2026-11-10T12:00:00Z');
const berlin = (local: string) => zonedToUtc(local, 'Europe/Berlin')!;
let repo: FakeRepo;
let m: Meetup;

// Weekly, 6 times, Wednesdays 19:00 Berlin from 2026-11-04.
beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  m = await repo.createMeetup({
    communityId: SEED_IDS.community,
    accessGroupId: SEED_IDS.members,
    channelId: null,
    title: 'Q&A',
    description: 'Ask.',
    location: 'https://zoom.us/j/1',
    timeZone: 'Europe/Berlin',
    startsAt: berlin('2026-11-04T19:00'),
    endsAt: berlin('2026-11-04T20:00'),
    repeat: { freq: 'weekly', every: 1, days: [], count: 6, until: null },
    createdAt: NOW,
  });
});

type Cmd<C> = C extends OccurrenceCommand ? Omit<C, 'meetupId'> : never;
const run = (c: Cmd<OccurrenceCommand>, id = m.id) => runOccurrenceCommand(repo, { ...c, meetupId: id });
const titles = async (id = m.id) => {
  const s = (await meetupSessions(repo, (await repo.meetup(id))!, NOW))!;
  return [...s.past, ...s.upcoming].map((o) => [o.n, o.title, o.cancelled]);
};

describe('meetupSessions', () => {
  it('lists past and upcoming occurrences with RSVP counts, cancelled ones flagged', async () => {
    await repo.setRsvp(m.id, 2, SEED_IDS.student, true, NOW);
    await run({ op: 'cancelOccurrence', occurrence: 3, scope: 'this' });
    const s = await meetupSessions(repo, m, NOW);
    expect(s.past.map((o) => o.key)).toEqual([m.id]);
    expect(s.upcoming.map((o) => [o.key, o.rsvpCount, o.cancelled])).toEqual([
      [`${m.id}_1`, 0, false],
      [`${m.id}_2`, 1, false],
      [`${m.id}_3`, 0, true],
      [`${m.id}_4`, 0, false],
      [`${m.id}_5`, 0, false],
    ]);
  });
});

describe('editOccurrence', () => {
  it('"this event" changes one occurrence only', async () => {
    await run({ op: 'editOccurrence', occurrence: 2, scope: 'this', patch: { title: 'Special' } });
    await run({ op: 'editOccurrence', occurrence: 2, scope: 'this', patch: { description: 'More.' } });
    expect((await repo.meetupOccurrences(m.id))[0]).toMatchObject({ occurrence: 2, title: 'Special', description: 'More.' });
    expect((await repo.meetup(m.id))?.title).toBe('Q&A');
  });

  it('"all events" changes the series, moves every occurrence and drops the same per-occurrence edits', async () => {
    await run({ op: 'editOccurrence', occurrence: 2, scope: 'this', patch: { title: 'Special', replayVimeoId: '7' } });
    const to = { startsAt: berlin('2026-11-12T18:00'), endsAt: berlin('2026-11-12T19:00') };
    await run({ op: 'editOccurrence', occurrence: 1, scope: 'all', patch: { title: 'Ask me', ...to } });
    const after = (await repo.meetup(m.id))!;
    expect(after).toMatchObject({ title: 'Ask me', startsAt: berlin('2026-11-05T18:00') });
    expect(await repo.meetupOccurrences(m.id)).toMatchObject([{ occurrence: 2, title: null, replayVimeoId: '7' }]);
  });

  it('"this and following" splits the series and edits the new one', async () => {
    const r = await run({ op: 'editOccurrence', occurrence: 4, scope: 'following', patch: { title: 'Later' } });
    expect((await repo.meetup(m.id))?.repeat?.count).toBe(4);
    expect(await repo.meetup(r!)).toMatchObject({ title: 'Later', startsAt: berlin('2026-12-02T19:00') });
    expect((await repo.meetup(r!))?.repeat?.count).toBe(2);
  });

  it('stores the replay on the occurrence it belongs to', async () => {
    await run({ op: 'editOccurrence', occurrence: 1, scope: 'all', patch: { replayVimeoId: '5' } });
    await run({ op: 'editOccurrence', occurrence: 0, scope: 'this', patch: { replayVimeoId: '4' } });
    expect((await repo.meetup(m.id))?.replayVimeoId).toBe('4');
    expect(await repo.meetupOccurrences(m.id)).toMatchObject([{ occurrence: 1, replayVimeoId: '5' }]);
  });

  it('the full edit form only applies the fields that changed', async () => {
    const form = (o: number, title: string) => ({
      title,
      description: 'Ask.',
      startsAt: berlin(`2026-11-${String(4 + 7 * o).padStart(2, '0')}T19:00`),
      endsAt: berlin(`2026-11-${String(4 + 7 * o).padStart(2, '0')}T20:00`),
      replayVimeoId: null,
    });
    await run({ op: 'editOccurrence', occurrence: 1, scope: 'this', patch: form(1, 'Special') });
    expect(await repo.meetupOccurrences(m.id)).toMatchObject([
      { occurrence: 1, title: 'Special', description: null, startsAt: null, replayVimeoId: null },
    ]);
    await run({ op: 'editOccurrence', occurrence: 2, scope: 'all', patch: form(2, 'Q&A') });
    expect(await repo.meetupOccurrences(m.id)).toMatchObject([{ occurrence: 1, title: 'Special' }]);
    // Typing the series value back clears the override.
    await run({ op: 'editOccurrence', occurrence: 1, scope: 'this', patch: form(1, 'Q&A') });
    expect(await repo.meetupOccurrences(m.id)).toMatchObject([{ occurrence: 1, title: null }]);
  });

  it('refuses missing or cancelled occurrences', async () => {
    await run({ op: 'cancelOccurrence', occurrence: 1, scope: 'this' });
    await expect(run({ op: 'editOccurrence', occurrence: 1, scope: 'this', patch: { title: 'x' } })).rejects.toThrow(
      'no such occurrence',
    );
    await expect(run({ op: 'editOccurrence', occurrence: 6, scope: 'all', patch: { title: 'x' } })).rejects.toThrow(
      'no such occurrence',
    );
  });
});

describe('cancelOccurrence', () => {
  it('cancels one, the rest of the series, or all of it', async () => {
    await run({ op: 'cancelOccurrence', occurrence: 1, scope: 'this' });
    expect((await titles()).filter(([, , c]) => c).map(([n]) => n)).toEqual([1]);
    await run({ op: 'cancelOccurrence', occurrence: 3, scope: 'following' });
    expect((await repo.meetups(SEED_IDS.community)).map((x) => [x.id, x.repeat?.count])).toEqual([[m.id, 3]]);
    await run({ op: 'cancelOccurrence', occurrence: 2, scope: 'all' });
    expect(await repo.meetup(m.id)).toBeNull();
  });

  it('a one-off meetup is deleted whatever the scope', async () => {
    const one = await repo.createMeetup({ ...m, repeat: null, createdAt: NOW });
    await run({ op: 'cancelOccurrence', occurrence: 0, scope: 'this' }, one.id);
    expect(await repo.meetup(one.id)).toBeNull();
  });
});
