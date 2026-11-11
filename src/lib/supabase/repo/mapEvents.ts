// Row -> domain type for challenges, entries, meetups, RSVPs.
import type { Challenge, ChallengeEntry, Meetup, MeetupRsvp } from '@/lib/data/types';
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
  createdAt: toDate(r.created_at),
});

export const toMeetupRsvp = (r: Row<'meetup_rsvps'>): MeetupRsvp => ({
  meetupId: r.meetup_id,
  profileId: r.profile_id,
  createdAt: toDate(r.created_at),
});
