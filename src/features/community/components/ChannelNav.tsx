// Channel list of one community (side nav): chat, private and read-only channels are labelled;
// Messages (with unread count) when the viewer has DMs, then Members, Challenges, Meetups and
// Leaderboard as the viewer's access groups switch them on.
import { NavLink } from '@/components/ui/links';
import { SideNav } from '@/components/ui/mds';
import type { Channel } from '@/lib/data/types';
import type { CommunityNav } from '../api/nav';
import { challengesHref, channelHref, leaderboardHref, meetupsHref, membersHref, messagesHref } from '../paths';

/** A channel id, or 'members' / 'messages' / 'challenges' / 'meetups' / 'leaderboard'. */
type Props = { community: string; title: string; channels: Channel[]; activeId: string; extras: CommunityNav };

export const channelLabel = (c: Channel): string => {
  const tags = [c.kind === 'chat' ? 'chat' : null, c.privacy === 'private' ? 'private' : null, c.readOnly ? 'read only' : null].filter(
    (t) => t !== null,
  );
  return tags.length === 0 ? c.title : `${c.title} (${tags.join(', ')})`;
};

const messagesLabel = (unread: number): string => (unread > 0 ? `Messages (${unread})` : 'Messages');

export function ChannelNav({ community, title, channels, activeId, extras }: Props) {
  return (
    <SideNav label={title}>
      {channels.map((c) => (
        <NavLink key={c.id} href={channelHref(community, c.id)} label={channelLabel(c)} active={c.id === activeId} />
      ))}
      {extras.dms ? <NavLink href={messagesHref(community)} label={messagesLabel(extras.dms.unread)} active={activeId === 'messages'} /> : null}
      {extras.directory ? <NavLink href={membersHref(community)} label="Members" active={activeId === 'members'} /> : null}
      {extras.challenges ? <NavLink href={challengesHref(community)} label="Challenges" active={activeId === 'challenges'} /> : null}
      {extras.meetups ? <NavLink href={meetupsHref(community)} label="Meetups" active={activeId === 'meetups'} /> : null}
      {extras.leaderboard ? (
        <NavLink href={leaderboardHref(community)} label="Leaderboard" active={activeId === 'leaderboard'} />
      ) : null}
    </SideNav>
  );
}
