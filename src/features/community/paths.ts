// Browser paths (host-relative; the proxy adds the space segment). SSOT for community links.
import type { LeaderboardPeriod } from './api/points';
export const communityHref = (community: string): string => `/community/${community}`;
export const channelHref = (community: string, channel: string): string => `/community/${community}/channels/${channel}`;
export const postHref = (community: string, post: string): string => `/community/${community}/posts/${post}`;
/** Signed-file routes: check read access, then redirect to a short-lived URL. */
export const postPhotoHref = (community: string, post: string, photo: string): string =>
  `${postHref(community, post)}/photos/${photo}`;
export const attachmentHref = (community: string, message: string): string => `/community/${community}/attachments/${message}`;
export const reportsHref = (community: string): string => `/community/${community}/reports`;
export const membersHref = (community: string): string => `/community/${community}/members`;
export const notificationsHref = '/notifications';
export const studioCommunitiesHref = '/studio/communities';
export const studioCommunityHref = (community: string): string => `/studio/communities/${community}`;
export const messagesHref = (community: string): string => `/community/${community}/messages`;
export const dmHref = (community: string, thread: string): string => `/community/${community}/messages/${thread}`;
export const challengesHref = (community: string): string => `/community/${community}/challenges`;
export const challengeHref = (community: string, challenge: string): string => `${challengesHref(community)}/${challenge}`;
export const challengeEntriesCsvHref = (community: string, challenge: string): string =>
  `${challengeHref(community, challenge)}/entries.csv`;
export const meetupsHref = (community: string): string => `/community/${community}/meetups`;
export const meetupHref = (community: string, meetup: string): string => `${meetupsHref(community)}/${meetup}`;
export const meetupIcsHref = (community: string, meetup: string): string => `${meetupHref(community, meetup)}/event.ics`;
/** All-time board without a period. */
export const leaderboardHref = (community: string, period?: LeaderboardPeriod): string =>
  `/community/${community}/leaderboard${period && period !== 'all' ? `?period=${period}` : ''}`;
export const studioEventsHref = (community: string): string => `${studioCommunityHref(community)}/events`;
export const studioReportsHref = (community: string): string => `${studioCommunityHref(community)}/reports`;
/** Studio page of one meetup's occurrences. */
export const studioMeetupHref = (community: string, meetup: string): string => `${studioEventsHref(community)}/${meetup}`;
