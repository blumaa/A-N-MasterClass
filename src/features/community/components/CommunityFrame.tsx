// Community shell: channel nav beside the content. activeId null = members page.
import type { ReactNode } from 'react';
import type { Channel, Product } from '@/lib/data/types';
import { ChannelNav } from './ChannelNav';
import styles from './community.module.css';

type Props = { community: Product; channels: Channel[]; activeId: string | null; children: ReactNode };

export function CommunityFrame({ community, channels, activeId, children }: Props) {
  return (
    <div className={styles.layout}>
      <aside>
        <ChannelNav community={community.slug} title={community.title} channels={channels} activeId={activeId} />
      </aside>
      <div>{children}</div>
    </div>
  );
}
