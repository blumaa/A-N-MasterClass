// Challenge and meetup forms -> commands. Studio forms post times as datetime-local values plus
// the `timeZone` they were typed in; they are stored as UTC instants. Member forms post entries
// and RSVPs.
import { body, field, flag, parser, readInstant, readTimeZone } from '@/lib/forms/commands';
import { FormError, type FormReader as Reader } from '@/lib/forms/formReader';
import { vimeoIdOf } from '@/lib/video/vimeo';
import type { ChallengeCommand } from './api/challenges';
import type { MeetupCommand } from './api/meetups';
import type { EventsCommand } from './api/studioEvents';

const LABELS = { startsAt: 'start time', endsAt: 'end time' } as const;

const instant = (r: Reader, name: keyof typeof LABELS): Date => readInstant(r, name, LABELS[name]);
const times = (r: Reader) => ({
  ...field(r, 'startsAt', () => instant(r, 'startsAt')),
  ...field(r, 'endsAt', () => instant(r, 'endsAt')),
});
function replay(r: Reader): string | null {
  const typed = r.raw('replayVimeoId');
  if (!typed) return null;
  const id = vimeoIdOf(typed);
  if (!id) throw new FormError('Paste a Vimeo link or video id.');
  return id;
}

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
      ...times(r),
    },
  }),
  deleteMeetup: (r) => ({ op: 'deleteMeetup', meetupId: r.required('meetupId') }),
};

const CHALLENGE: Record<ChallengeCommand['op'], (r: Reader) => ChallengeCommand> = {
  enter: (r) => ({ op: 'enter', challengeId: r.required('challengeId'), body: body(r) }),
  withdraw: (r) => ({ op: 'withdraw', challengeId: r.required('challengeId') }),
};

const MEETUP: Record<MeetupCommand['op'], (r: Reader) => MeetupCommand> = {
  rsvp: (r) => ({ op: 'rsvp', meetupId: r.required('meetupId'), on: flag(r, 'on') }),
};

export const eventsCommandFromForm = parser<EventsCommand>(STUDIO);
export const challengeCommandFromForm = parser<ChallengeCommand>(CHALLENGE);
export const meetupCommandFromForm = parser<MeetupCommand>(MEETUP);
