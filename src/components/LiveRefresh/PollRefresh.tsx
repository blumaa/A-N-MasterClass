'use client';
import { useEffect } from 'react';
import { useRefreshScheduler } from './useRefreshScheduler';

/** Fake data has no Realtime: poll instead. */
export const LIVE_POLL_MS = 5_000;

export function PollRefresh() {
  const poke = useRefreshScheduler();
  useEffect(() => {
    const id = window.setInterval(poke, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [poke]);
  return null;
}
