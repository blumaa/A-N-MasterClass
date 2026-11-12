// Keeps a server-rendered page fresh. Supabase data: private Realtime topics (invalidate only).
// Fake data: no Realtime, so poll. Same props either way.
import { dataSource } from '@/config/dataSource';
import { PollRefresh } from './PollRefresh';
import { RealtimeRefresh } from './RealtimeRefresh';

type Props = { topics: readonly string[] };

export function LiveRefresh({ topics }: Props) {
  return dataSource() === 'supabase' ? <RealtimeRefresh topics={topics} /> : <PollRefresh />;
}
