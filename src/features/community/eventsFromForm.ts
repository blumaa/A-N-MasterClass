// Challenge and meetup forms -> commands. Studio forms post times as datetime-local values plus
// the `timeZone` they were typed in; they are stored as UTC instants. Member forms post entries
// and RSVPs. Repeats: `repeatFreq` ('none' or a freq), `repeatEvery`, `repeatDays` (ISO weekdays,
// weekly only), `repeatEnd` (never / count / until) with `repeatCount` or `repeatUntil`.
import { REPEAT_FREQS, type Repeat } from '@/lib/data/types';
import { body, field, flag, parser, readInstant, readTimeZone, readWhole } from '@/lib/forms/commands';
import { FormError, type FormReader as Reader } from '@/lib/forms/formReader';
import { vimeoIdOf } from '@/lib/video/vimeo';
import type { ChallengeCommand } from './api/challenges';
import type { MeetupCommand } from './api/meetups';
import { SESSION_SCOPES, type OccurrencePatch } from './api/meetupSessions';
import type { EventsCommand } from './api/studioEvents';

const LABELS = { startsAt: 'start time', endsAt: 'end time' } as const;

const instant = (r: Reader, name: keyof typeof LABELS): Date => readInstant(r, name, LABELS[name]);
const times = (r: Reader) => ({
  ...field(r, 'startsAt', () => instant(r, 'startsAt')),
  ...field(r, 'endsAt', () => instant(r, 'endsAt')),
});
/** Both times or neither (an occurrence keeps its length only as a pair). */
const timePair = (r: Reader) =>
  r.raw('startsAt') === undefined && r.raw('endsAt') === undefined
    ? {}
    : { startsAt: instant(r, 'startsAt'), endsAt: instant(r, 'endsAt') };
function replay(r: Reader): string | null {
  const typed = r.raw('replayVimeoId');
  if (!typed) return null;
  const id = vimeoIdOf(typed);
  if (!id) throw new FormError('Paste a Vimeo link or video id.');
  return id;
}

const REPEAT_ENDS = ['never', 'count', 'until'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function untilDate(r: Reader): string {
  const v = r.raw('repeatUntil') ?? '';
  if (!DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00Z`))) throw new FormError('Pick a valid end date.');
  return v;
}

function weekdays(r: Reader): number[] {
  const days = r.all('repeatDays');
  if (days.some((d) => !/^[1-7]$/.test(d))) throw new FormError('Pick valid weekdays.');
  return [...new Set(days.map(Number))].toSorted((a, b) => a - b);
}

function readRepeat(r: Reader): Repeat | null {
  if (!r.raw('repeatFreq')) return null;
  const freq = r.oneOf('repeatFreq', ['none', ...REPEAT_FREQS]);
  if (freq === 'none') return null;
  const end = r.oneOf('repeatEnd', REPEAT_ENDS);
  return {
    freq,
    every: readWhole(r, 'repeatEvery', 'repeat interval'),
    days: freq === 'weekly' ? weekdays(r) : [],
    count: end === 'count' ? readWhole(r, 'repeatCount', 'number of times') : null,
    until: end === 'until' ? untilDate(r) : null,
  };
}

const occurrence = (r: Reader) => ({
  meetupId: r.required('meetupId'),
  occurrence: readWhole(r, 'occurrence', 'occurrence'),
});

const occurrencePatch = (r: Reader): OccurrencePatch => ({
  ...field(r, 'title', () => r.required('title')),
  ...field(r, 'description', () => r.raw('description') ?? ''),
  ...field(r, 'replayVimeoId', () => replay(r)),
  ...timePair(r),
});

const STUDIO: Record<EventsCommand['op'], (r: Reader) => EventsCommand> = {
  createChallenge: (r) => ({
    op: 'createChallenge',
    communityId: r.required('communityId'),
    accessGroupId: r.required('accessGroupId'),
    title: r.required('title'),
    description: r.raw('description') ?? '',
    prize: r.raw('prize') || null,
    startsAt: instant(r, 'startsAt'),
    endsAt: instant(r, 'endsAt'),
    showBeforeStart: flag(r, 'showBeforeStart'),
  }),
  updateChallenge: (r) => ({
    op: 'updateChallenge',
    challengeId: r.required('challengeId'),
    patch: {
      ...field(r, 'title', () => r.required('title')),
      ...field(r, 'description', () => r.raw('description') ?? ''),
      ...field(r, 'prize', () => r.raw('prize') || null),
      ...field(r, 'showBeforeStart', () => flag(r, 'showBeforeStart')),
      ...times(r),
    },
  }),
  deleteChallenge: (r) => ({ op: 'deleteChallenge', challengeId: r.required('challengeId') }),
  createMeetup: (r) => ({
    op: 'createMeetup',
    communityId: r.required('communityId'),
    accessGroupId: r.required('accessGroupId'),
    channelId: r.raw('channelId') || null,
    title: r.required('title'),
    description: r.raw('description') ?? '',
    location: r.required('location'),
    timeZone: readTimeZone(r),
    startsAt: instant(r, 'startsAt'),
    endsAt: instant(r, 'endsAt'),
    repeat: readRepeat(r),
  }),
  updateMeetup: (r) => ({
    op: 'updateMeetup',
    meetupId: r.required('meetupId'),
    patch: {
      ...field(r, 'title', () => r.required('title')),
      ...field(r, 'description', () => r.raw('description') ?? ''),
      ...field(r, 'location', () => r.required('location')),
      ...field(r, 'channelId', () => r.raw('channelId') || null),
      ...field(r, 'timeZone', () => readTimeZone(r)),
      ...field(r, 'replayVimeoId', () => replay(r)),
      ...(r.raw('repeatFreq') === undefined ? {} : { repeat: readRepeat(r) }),
      ...times(r),
    },
  }),
  deleteMeetup: (r) => ({ op: 'deleteMeetup', meetupId: r.required('meetupId') }),
  editOccurrence: (r) => ({
    op: 'editOccurrence',
    ...occurrence(r),
    scope: r.oneOf('scope', SESSION_SCOPES),
    patch: occurrencePatch(r),
  }),
  cancelOccurrence: (r) => ({ op: 'cancelOccurrence', ...occurrence(r), scope: r.oneOf('scope', SESSION_SCOPES) }),
};

const CHALLENGE: Record<ChallengeCommand['op'], (r: Reader) => ChallengeCommand> = {
  enter: (r) => ({ op: 'enter', challengeId: r.required('challengeId'), body: body(r) }),
  withdraw: (r) => ({ op: 'withdraw', challengeId: r.required('challengeId') }),
};

const MEETUP: Record<MeetupCommand['op'], (r: Reader) => MeetupCommand> = {
  rsvp: (r) => ({ op: 'rsvp', ...occurrence(r), on: flag(r, 'on') }),
};

export const eventsCommandFromForm = parser<EventsCommand>(STUDIO);
export const challengeCommandFromForm = parser<ChallengeCommand>(CHALLENGE);
export const meetupCommandFromForm = parser<MeetupCommand>(MEETUP);
