'use client';
// Re-subscribes a device whose push the browser or the server dropped, once per page load.
// Recovery of a standing yes (permission granted and push turned on here): never asks anything.
// Ported from kinbaku-study-group app/PushHeal.tsx.
import { useEffect } from 'react';
import { reportError } from '@/lib/errors/report';
import { currentAvailability, heal } from '@/lib/push/browserPush';
import { pushServer } from './pushServer';

export function PushHeal({ publicKey }: { publicKey: string }) {
  useEffect(() => {
    if (currentAvailability() !== 'ready') return;
    // A failed heal is the next load's job; the member sees nothing, we see the error.
    heal(pushServer, publicKey).catch(reportError);
  }, [publicKey]);
  return null;
}
