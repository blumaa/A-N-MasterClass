'use client';
// Chat and DM pages re-fetch from the server every few seconds while the tab is visible.
// Deterministic: the server render is the only source of truth, nothing is patched client-side.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const LIVE_REFRESH_MS = 5_000;

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
