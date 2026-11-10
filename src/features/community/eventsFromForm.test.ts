import { describe, expect, it } from 'vitest';
import { challengeCommandFromForm, eventsCommandFromForm, meetupCommandFromForm } from './eventsFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
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

describe('member event forms', () => {
  it('reads challenge entries and RSVPs', () => {
    expect(challengeCommandFromForm(form({ op: 'enter', challengeId: 'x', body: 'done' }))).toEqual({
      ok: true,
      command: { op: 'enter', challengeId: 'x', body: 'done' },
    });
    expect(challengeCommandFromForm(form({ op: 'withdraw', challengeId: 'x' }))).toMatchObject({ ok: true });
    expect(meetupCommandFromForm(form({ op: 'rsvp', meetupId: 'm', on: 'false' }))).toEqual({
      ok: true,
      command: { op: 'rsvp', meetupId: 'm', on: false },
    });
  });
});
