// Channel list of one community (side nav): chat, private and read-only channels are labelled;
// Messages (with unread count) when the viewer has DMs, Members when the directory is open.
import { NavLink } from '@/components/ui/links';
import { SideNav } from '@/components/ui/mds';
import type { Channel } from '@/lib/data/types';
import type { CommunityNav } from '../api/dms';
import { channelHref, membersHref, messagesHref } from '../paths';

/** A channel id, or 'members' / 'messages'. */
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
    </SideNav>
  );
}
