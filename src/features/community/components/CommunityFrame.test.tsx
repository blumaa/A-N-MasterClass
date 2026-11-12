import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenStale } from '@/lib/realtime/privateChannel';
import type { Product } from '@/lib/data/types';
import type { CommunityNav } from '../api/nav';
import { CommunityFrame } from './CommunityFrame';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/' }));
vi.mock('@/lib/realtime/browserClient', () => ({ browserClient: () => 'client' }));
vi.mock('@/lib/realtime/privateChannel', () => ({ listenStale: vi.fn(() => () => {}) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(listenStale).mockClear();
});

const community = { id: 'c1', slug: 'circle', title: 'Circle' } as Product;
const extras: CommunityNav = {
  directory: false,
  dms: { unread: 0 },
  challenges: false,
  meetups: false,
  leaderboard: false,
  reports: false,
  live: ['community:c1', 'inbox:u1'],
};

describe('CommunityFrame', () => {
  it('listens on the nav topics on every community page', () => {
    vi.stubEnv('DATA_SOURCE', 'supabase');
    render(
      <CommunityFrame community={community} channels={[]} activeId="messages" extras={extras}>
        <p>body</p>
      </CommunityFrame>,
    );
    expect(vi.mocked(listenStale).mock.calls.map((c) => c[1])).toEqual(['community:c1', 'inbox:u1']);
  });

  it('adds page topics to the same listener set', () => {
    vi.stubEnv('DATA_SOURCE', 'supabase');
    render(
      <CommunityFrame community={community} channels={[]} activeId="messages" extras={extras} live={['dm:t1']}>
        <p>body</p>
      </CommunityFrame>,
    );
    expect(vi.mocked(listenStale).mock.calls.map((c) => c[1])).toEqual(['community:c1', 'inbox:u1', 'dm:t1']);
  });
});
