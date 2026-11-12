import { expect, it } from 'vitest';
import {
  challengeEntriesCsvHref,
  challengeHref,
  challengesHref,
  channelHref,
  communityHref,
  leaderboardHref,
  meetupHref,
  meetupIcsHref,
  meetupsHref,
  membersHref,
  reportsHref,
  reviewTabHref,
  notificationsHref,
  postHref,
  postPhotoHref,
  attachmentHref,
  studioCommunitiesHref,
  studioCommunityHref,
  studioEventsHref,
  studioMeetupHref,
  studioReportsHref,
} from './paths';

it('builds host-relative community paths', () => {
  expect(communityHref('circle')).toBe('/community/circle');
  expect(channelHref('circle', 'ch-1')).toBe('/community/circle/channels/ch-1');
  expect(postHref('circle', 'p-1')).toBe('/community/circle/posts/p-1');
  expect(membersHref('circle')).toBe('/community/circle/members');
  expect(reportsHref('circle')).toBe('/community/circle/reports');
  expect(reviewTabHref('/community/circle/reports', 'reports')).toBe('/community/circle/reports');
  expect(reviewTabHref('/community/circle/reports', 'hidden')).toBe('/community/circle/reports?tab=hidden');
  expect(notificationsHref).toBe('/notifications');
  expect(studioCommunitiesHref).toBe('/studio/communities');
  expect(studioCommunityHref('c-1')).toBe('/studio/communities/c-1');
});

it('builds challenge, meetup and leaderboard paths', () => {
  expect(challengesHref('circle')).toBe('/community/circle/challenges');
  expect(challengeHref('circle', 'x')).toBe('/community/circle/challenges/x');
  expect(challengeEntriesCsvHref('circle', 'x')).toBe('/community/circle/challenges/x/entries.csv');
  expect(meetupsHref('circle')).toBe('/community/circle/meetups');
  expect(meetupHref('circle', 'm')).toBe('/community/circle/meetups/m');
  expect(meetupIcsHref('circle', 'm')).toBe('/community/circle/meetups/m/event.ics');
  expect(leaderboardHref('circle')).toBe('/community/circle/leaderboard');
  expect(leaderboardHref('circle', 'week')).toBe('/community/circle/leaderboard?period=week');
  expect(studioEventsHref('c-1')).toBe('/studio/communities/c-1/events');
  expect(studioMeetupHref('c-1', 'm')).toBe('/studio/communities/c-1/events/m');
  expect(studioReportsHref('c-1')).toBe('/studio/communities/c-1/reports');
});

it('builds signed file paths', () => {
  expect(postPhotoHref('circle', 'p-1', 'ph-1')).toBe('/community/circle/posts/p-1/photos/ph-1');
  expect(attachmentHref('circle', 'm-1')).toBe('/community/circle/attachments/m-1');
});
