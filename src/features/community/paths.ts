// Browser paths (host-relative; the proxy adds the space segment). SSOT for community links.
export const communityHref = (community: string): string => `/community/${community}`;
export const channelHref = (community: string, channel: string): string => `/community/${community}/channels/${channel}`;
export const postHref = (community: string, post: string): string => `/community/${community}/posts/${post}`;
export const membersHref = (community: string): string => `/community/${community}/members`;
export const notificationsHref = '/notifications';
export const studioCommunitiesHref = '/studio/communities';
export const studioCommunityHref = (community: string): string => `/studio/communities/${community}`;
export const messagesHref = (community: string): string => `/community/${community}/messages`;
export const dmHref = (community: string, thread: string): string => `/community/${community}/messages/${thread}`;
