// Community shell: channel nav (plus Messages / Members extras) beside the content; on phones the
// nav sits behind a button named after the community.
import type { ReactNode } from 'react';
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
  children: ReactNode;
};

export function CommunityFrame({ community, channels, activeId, extras, children }: Props) {
  return (
    <SectionLayout
      label={community.title}
      nav={<ChannelNav community={community.slug} title={community.title} channels={channels} activeId={activeId} extras={extras} />}
    >
      {children}
    </SectionLayout>
  );
}
