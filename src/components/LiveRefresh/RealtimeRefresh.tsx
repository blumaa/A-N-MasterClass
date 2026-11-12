'use client';
import { useEffect } from 'react';
import { browserClient } from '@/lib/realtime/browserClient';
import { listenStale } from '@/lib/realtime/privateChannel';
import { useRefreshScheduler } from './useRefreshScheduler';

type Props = { topics: readonly string[] };

/** Invalidate only: a stale hint on any topic schedules router.refresh; no data from the event. */
export function RealtimeRefresh({ topics }: Props) {
  const poke = useRefreshScheduler();
  const key = topics.join('|');

  useEffect(() => {
    if (key === '') return;
    const client = browserClient();
    const closers = key.split('|').map((topic) => listenStale(client, topic, poke));
    return () => closers.forEach((close) => close());
  }, [key, poke]);

  return null;
}
