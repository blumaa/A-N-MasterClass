import { expect, it } from 'vitest';
import { channelHref, communityHref, membersHref, notificationsHref, postHref, studioCommunitiesHref, studioCommunityHref } from './paths';

it('builds host-relative community paths', () => {
  expect(communityHref('circle')).toBe('/community/circle');
  expect(channelHref('circle', 'ch-1')).toBe('/community/circle/channels/ch-1');
  expect(postHref('circle', 'p-1')).toBe('/community/circle/posts/p-1');
  expect(membersHref('circle')).toBe('/community/circle/members');
  expect(notificationsHref).toBe('/notifications');
  expect(studioCommunitiesHref).toBe('/studio/communities');
  expect(studioCommunityHref('c-1')).toBe('/studio/communities/c-1');
});
