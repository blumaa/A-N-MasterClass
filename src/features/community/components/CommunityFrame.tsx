// Community shell: channel nav (plus Messages / Members extras) beside the content; on phones the
// nav sits behind a button named after the community. The frame owns the nav's realtime listeners.
import type { ReactNode } from 'react';
import { LiveRefresh } from '@/components/LiveRefresh/LiveRefresh';
import { SectionLayout } from '@/components/SectionLayout/SectionLayout';
import type { Channel, Product } from '@/lib/data/types';
import type { CommunityNav } from '../api/nav';
import { ChannelNav } from './ChannelNav';

type Props = {
  community: Product;
  channels: Channel[];
  /** A channel id, or 'members' / 'messages'. */
  activeId: string;
  extras: CommunityNav;
  /** Page realtime topics. Joined with the nav topics in one listener, so one hint burst = one refresh. */
  live?: readonly string[];
  children: ReactNode;
};

const NONE: readonly string[] = [];

export function CommunityFrame({ community, channels, activeId, extras, live = NONE, children }: Props) {
  return (
    <SectionLayout
      label={community.title}
      nav={<ChannelNav community={community.slug} title={community.title} channels={channels} activeId={activeId} extras={extras} />}
    >
      <LiveRefresh topics={[...extras.live, ...live]} />
      {children}
    </SectionLayout>
  );
}
