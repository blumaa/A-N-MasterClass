// Channel list of one community (side nav). Read-only channels are labelled.
import { NavLink } from '@/components/ui/links';
import { SideNav } from '@/components/ui/mds';
import type { Channel } from '@/lib/data/types';
import { channelHref, membersHref } from '../paths';

type Props = { community: string; title: string; channels: Channel[]; activeId: string | null };

const label = (c: Channel): string => (c.visibility === 'read_only' ? `${c.title} (read only)` : c.title);

export function ChannelNav({ community, title, channels, activeId }: Props) {
  return (
    <SideNav label={title}>
      {channels.map((c) => (
        <NavLink key={c.id} href={channelHref(community, c.id)} label={label(c)} active={c.id === activeId} />
      ))}
      <NavLink href={membersHref(community)} label="Members" active={activeId === null} />
    </SideNav>
  );
}
