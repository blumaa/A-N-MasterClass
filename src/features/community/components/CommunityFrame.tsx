// Community shell: channel nav (plus Messages / Members extras) beside the content.
import type { ReactNode } from 'react';
import type { Channel, Product } from '@/lib/data/types';
import type { CommunityNav } from '../api/nav';
import { ChannelNav } from './ChannelNav';
import styles from './community.module.css';

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
    <div className={styles.layout}>
      <aside>
        <ChannelNav community={community.slug} title={community.title} channels={channels} activeId={activeId} extras={extras} />
      </aside>
      <div>{children}</div>
    </div>
  );
}
