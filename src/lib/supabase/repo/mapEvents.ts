// Row -> domain type for challenges, entries, meetups, occurrence edits, RSVPs.
import type { Challenge, ChallengeEntry, Meetup, MeetupOccurrence, MeetupRsvp, Repeat, RepeatFreq } from '@/lib/data/types';
import { toDate, type Row } from './context';

export const toChallenge = (r: Row<'challenges'>): Challenge => ({
  id: r.id,
  communityId: r.community_id,
  accessGroupId: r.access_group_id,
  title: r.title,
  description: r.description,
  prize: r.prize,
  startsAt: toDate(r.starts_at),
  endsAt: toDate(r.ends_at),
  showBeforeStart: r.show_before_start,
  createdAt: toDate(r.created_at),
});

export const toChallengeEntry = (r: Row<'challenge_entries'>): ChallengeEntry => ({
  challengeId: r.challenge_id,
  profileId: r.profile_id,
  body: r.body,
  createdAt: toDate(r.created_at),
});

/** meetups.location is not selectable by clients, so the row arrives without it. */
export type MeetupRow = Omit<Row<'meetups'>, 'location'>;

export const toMeetup = (r: MeetupRow, location: string): Meetup => ({
  id: r.id,
  communityId: r.community_id,
  accessGroupId: r.access_group_id,
  channelId: r.channel_id,
  title: r.title,
  description: r.description,
  location,
  timeZone: r.time_zone,
  startsAt: toDate(r.starts_at),
  endsAt: toDate(r.ends_at),
  replayVimeoId: r.replay_vimeo_id,
  repeat: toRepeat(r),
  createdAt: toDate(r.created_at),
});

/** meetups_repeat_freq keeps repeat_freq inside REPEAT_FREQS. */
const toRepeat = (r: MeetupRow): Repeat | null =>
  r.repeat_freq === null
    ? null
    : {
        freq: r.repeat_freq as RepeatFreq,
        every: r.repeat_every,
        days: r.repeat_days,
        count: r.repeat_count,
        until: r.repeat_until,
      };

/** Repeat -> meetups columns; null clears every repeat column. */
export const repeatColumns = (r: Repeat | null) => ({
  repeat_freq: r?.freq ?? null,
  repeat_every: r?.every ?? 1,
  repeat_days: r?.days ?? [],
  repeat_count: r?.count ?? null,
  repeat_until: r?.until ?? null,
});

export const toMeetupOccurrence = (r: Row<'meetup_occurrences'>): MeetupOccurrence => ({
  meetupId: r.meetup_id,
  occurrence: r.occurrence,
  cancelled: r.cancelled,
  title: r.title,
  description: r.description,
  startsAt: r.starts_at === null ? null : toDate(r.starts_at),
  endsAt: r.ends_at === null ? null : toDate(r.ends_at),
  replayVimeoId: r.replay_vimeo_id,
});

export const toMeetupRsvp = (r: Row<'meetup_rsvps'>): MeetupRsvp => ({
  meetupId: r.meetup_id,
  occurrence: r.occurrence,
  profileId: r.profile_id,
  createdAt: toDate(r.created_at),
});
