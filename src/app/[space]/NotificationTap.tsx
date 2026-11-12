'use client';
// A push tap lands on what it was about. Two routes in, ported from kinbaku-study-group
// useNotificationTap: a window was open, so the worker posts { type: 'navigate', url } (iOS
// standalone ignores WindowClient.navigate()); or the app was launched, so iOS opened start_url
// and the worker parked the url in Cache Storage (pendingTap.ts). Mounted once in the space layout.
// Not built: mark read on tap (push payloads carry no notification id).
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { sameOriginPath, takePendingTap } from '@/lib/push/pendingTap';

export function NotificationTap() {
  const router = useRouter();

  // Launch path: every boot reads once; no parked tap is the normal case.
  useEffect(() => {
    let cancelled = false;
    void takePendingTap().then((path) => {
      if (!cancelled && path) router.push(path);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Open-window path. A message is not proof of origin: same-origin absolute urls only.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const worker = navigator.serviceWorker;
    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      if (typeof data !== 'object' || data === null || (data as { type?: unknown }).type !== 'navigate') return;
      const path = sameOriginPath((data as { url?: unknown }).url);
      if (!path) return;
      // The worker parked this tap too; drain it so a relaunch within the ttl is not moved again.
      void takePendingTap();
      router.push(path);
    };
    worker.addEventListener('message', onMessage);
    return () => worker.removeEventListener('message', onMessage);
  }, [router]);

  return null;
}
