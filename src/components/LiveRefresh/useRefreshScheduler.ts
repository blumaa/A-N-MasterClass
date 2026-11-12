'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { createRefreshScheduler, type RefreshScheduler } from '@/lib/realtime/refreshScheduler';

const isVisible = () => document.visibilityState === 'visible';

/** Scheduler bound to router.refresh and tab visibility. Returns a stable poke. */
export function useRefreshScheduler(): () => void {
  const router = useRouter();
  const scheduler = useRef<RefreshScheduler | null>(null);

  useEffect(() => {
    const s = createRefreshScheduler({ refresh: () => router.refresh(), isVisible });
    scheduler.current = s;
    const onVisibility = () => s.visible();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      s.dispose();
      scheduler.current = null;
    };
  }, [router]);

  return useCallback(() => scheduler.current?.poke(), []);
}
