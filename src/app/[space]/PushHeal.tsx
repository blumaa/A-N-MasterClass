'use client';
// Once per page load. Signed in: re-subscribes a device whose push the browser or the server
// dropped, if this account turned it on here (never asks anything). Signed out: drops any
// subscription left here, so a shared device stops getting the last account's pushes.
// Ported from kinbaku-study-group app/PushHeal.tsx.
import { useEffect } from 'react';
import { reportError } from '@/lib/errors/report';
import { currentAvailability, dropPush, heal } from '@/lib/push/browserPush';
import { pushServer } from './pushServer';

export function PushHeal({ publicKey, profileId }: { publicKey: string; profileId: string | null }) {
  useEffect(() => {
    if (currentAvailability() !== 'ready') return;
    // A failure is the next load's job; the member sees nothing, we see the error.
    (profileId ? heal(pushServer, publicKey, profileId) : dropPush()).catch(reportError);
  }, [publicKey, profileId]);
  return null;
}
