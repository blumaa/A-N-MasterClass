import { describe, expect, it } from 'vitest';
import { challengeCommandFromForm, eventsCommandFromForm, meetupCommandFromForm } from './eventsFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const withDays = (fields: Record<string, string>, days: string[]): FormData => {
  const f = form(fields);
  for (const d of days) f.append('repeatDays', d);
  return f;
};
const WINDOW = { timeZone: 'Europe/Berlin', startsAt: '2026-11-12T19:00', endsAt: '2026-11-12T20:30' };

describe('eventsCommandFromForm', () => {
  it('reads a challenge with local times in the chosen zone', () => {
    expect(
      eventsCommandFromForm(
        form({
          op: 'createChallenge',
          communityId: 'c',
          accessGroupId: 'g',
          title: 'Tie a day',
          description: '',
          prize: '',
          showBeforeStart: 'true',
          ...WINDOW,
        }),
      ),
    ).toEqual({
      ok: true,
      command: {
        op: 'createChallenge',
        communityId: 'c',
        accessGroupId: 'g',
        title: 'Tie a day',
        description: '',
        prize: null,
        startsAt: new Date('2026-11-12T18:00:00Z'),
        endsAt: new Date('2026-11-12T19:30:00Z'),
        showBeforeStart: true,
      },
    });
  });

  it('reads a meetup and keeps its zone', () => {
    const parsed = eventsCommandFromForm(
      form({ op: 'createMeetup', communityId: 'c', accessGroupId: 'g', channelId: '', title: 'Q&A', description: 'd', location: 'https://zoom.us/j/1', ...WINDOW }),
    );
    expect(parsed).toMatchObject({ ok: true, command: { channelId: null, timeZone: 'Europe/Berlin', startsAt: new Date('2026-11-12T18:00:00Z') } });
  });

  it('patches only the fields present; replay accepts a Vimeo link', () => {
    expect(eventsCommandFromForm(form({ op: 'updateMeetup', meetupId: 'm', replayVimeoId: 'https://vimeo.com/76979871' }))).toEqual({
      ok: true,
      command: { op: 'updateMeetup', meetupId: 'm', patch: { replayVimeoId: '76979871' } },
    });
    expect(eventsCommandFromForm(form({ op: 'updateMeetup', meetupId: 'm', replayVimeoId: '' }))).toMatchObject({
      command: { patch: { replayVimeoId: null } },
    });
    expect(eventsCommandFromForm(form({ op: 'updateChallenge', challengeId: 'x', title: 'New' }))).toEqual({
      ok: true,
      command: { op: 'updateChallenge', challengeId: 'x', patch: { title: 'New' } },
    });
  });

  it('refuses bad times, zones and replay links', () => {
    expect(eventsCommandFromForm(form({ op: 'updateChallenge', challengeId: 'x', ...WINDOW, startsAt: 'soon' }))).toEqual({
      ok: false,
      message: 'Pick a valid start time.',
    });
    expect(eventsCommandFromForm(form({ op: 'updateChallenge', challengeId: 'x', ...WINDOW, timeZone: 'Mars/Base' }))).toEqual({
      ok: false,
      message: 'Pick a valid time zone.',
    });
    expect(eventsCommandFromForm(form({ op: 'updateMeetup', meetupId: 'm', replayVimeoId: 'youtube.com/x' }))).toEqual({
      ok: false,
      message: 'Paste a Vimeo link or video id.',
    });
  });
});

describe('meetup repeats', () => {
  const create = { op: 'createMeetup', communityId: 'c', accessGroupId: 'g', title: 'Q&A', location: 'https://zoom.us/j/1', ...WINDOW };
  const repeatOf = (f: FormData) => {
    const parsed = eventsCommandFromForm(f);
    if (!parsed.ok) return parsed.message;
    return parsed.command.op === 'createMeetup' ? parsed.command.repeat : 'wrong op';
  };

  it('reads none, weekly days with a count, and monthly until a date', () => {
    expect(repeatOf(form({ ...create, repeatFreq: 'none' }))).toBeNull();
    expect(repeatOf(form(create))).toBeNull();
    expect(repeatOf(withDays({ ...create, repeatFreq: 'weekly', repeatEvery: '2', repeatEnd: 'count', repeatCount: '6' }, ['5', '1']))).toEqual({
      freq: 'weekly',
      every: 2,
      days: [1, 5],
      count: 6,
      until: null,
    });
    expect(
      repeatOf(withDays({ ...create, repeatFreq: 'monthly', repeatEvery: '1', repeatEnd: 'until', repeatUntil: '2027-06-30' }, ['1'])),
    ).toEqual({ freq: 'monthly', every: 1, days: [], count: null, until: '2027-06-30' });
  });

  it('refuses bad repeat values', () => {
    expect(repeatOf(form({ ...create, repeatFreq: 'daily', repeatEvery: 'x', repeatEnd: 'never' }))).toBe(
      'Enter a whole number for repeat interval.',
    );
    expect(repeatOf(form({ ...create, repeatFreq: 'daily', repeatEvery: '1', repeatEnd: 'until', repeatUntil: 'soon' }))).toBe(
      'Pick a valid end date.',
    );
    expect(repeatOf(withDays({ ...create, repeatFreq: 'weekly', repeatEvery: '1', repeatEnd: 'never' }, ['8']))).toBe(
      'Pick valid weekdays.',
    );
  });

  it('patches the repeat only when the repeat fields are posted', () => {
    expect(eventsCommandFromForm(form({ op: 'updateMeetup', meetupId: 'm', repeatFreq: 'none' }))).toEqual({
      ok: true,
      command: { op: 'updateMeetup', meetupId: 'm', patch: { repeat: null } },
    });
  });

  it('reads occurrence edits and cancels with a scope', () => {
    expect(
      eventsCommandFromForm(
        form({ op: 'editOccurrence', meetupId: 'm', occurrence: '2', scope: 'following', title: 'Later', ...WINDOW }),
      ),
    ).toEqual({
      ok: true,
      command: {
        op: 'editOccurrence',
        meetupId: 'm',
        occurrence: 2,
        scope: 'following',
        patch: { title: 'Later', startsAt: new Date('2026-11-12T18:00:00Z'), endsAt: new Date('2026-11-12T19:30:00Z') },
      },
    });
    expect(eventsCommandFromForm(form({ op: 'cancelOccurrence', meetupId: 'm', occurrence: '0', scope: 'all' }))).toEqual({
      ok: true,
      command: { op: 'cancelOccurrence', meetupId: 'm', occurrence: 0, scope: 'all' },
    });
    expect(eventsCommandFromForm(form({ op: 'cancelOccurrence', meetupId: 'm', occurrence: '0', scope: 'some' }))).toMatchObject({
      ok: false,
    });
  });
});

describe('member event forms', () => {
  it('reads challenge entries and RSVPs', () => {
    expect(challengeCommandFromForm(form({ op: 'enter', challengeId: 'x', body: 'done' }))).toEqual({
      ok: true,
      command: { op: 'enter', challengeId: 'x', body: 'done' },
    });
    expect(challengeCommandFromForm(form({ op: 'withdraw', challengeId: 'x' }))).toMatchObject({ ok: true });
    expect(meetupCommandFromForm(form({ op: 'rsvp', meetupId: 'm', occurrence: '3', on: 'false' }))).toEqual({
      ok: true,
      command: { op: 'rsvp', meetupId: 'm', occurrence: 3, on: false },
    });
  });
});
