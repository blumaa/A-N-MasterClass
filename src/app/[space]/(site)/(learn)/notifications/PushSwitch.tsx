'use client';
// Per-device web push opt-in (Launch 6 item 6). Settles where the write landed: no optimistic on.
// iOS/iPadOS Safari gets push only as a home-screen app, so it gets instructions, not a switch.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Stack, Switch, Text } from '@/components/ui/mds';
import type { PushAvailability } from '@/lib/push/availability';
import { currentAvailability, isSubscribed, subscribe, unsubscribe } from '@/lib/push/browserPush';
import { reportError } from '@/lib/errors/report';
import { pushServer } from '../../../pushServer';

const NOTES: Record<Exclude<PushAvailability, 'ready'>, string> = {
  install:
    'On iPhone and iPad, push notifications work only in the app: tap Share, then Add to Home Screen (iOS 16.4 or later), open it from your Home Screen and turn push on here.',
  unsupported: 'This browser cannot get push notifications. You still see them here.',
  blocked: 'Notifications are blocked for this site. Allow them in your browser settings to turn push on.',
};

// Permission and install state have no change event; they are re-read on every render.
const noSubscribe = () => () => {};
const serverAvailability = () => null;

const reason = (error: unknown) => (error instanceof Error && error.message ? error.message : 'Push could not be changed. Try again.');

export function PushSwitch({ publicKey }: { publicKey: string }) {
  // Browser APIs: null on the server and during hydration, so both renders match.
  const availability = useSyncExternalStore(noSubscribe, currentAvailability, serverAvailability);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (availability !== 'ready') return;
    isSubscribed(pushServer, publicKey)
      .then(setOn, (e: unknown) => {
        reportError(e);
        setError(reason(e));
      })
      .finally(() => setBusy(false));
  }, [availability, publicKey]);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (next) await subscribe(pushServer, publicKey);
      else await unsubscribe(pushServer);
      setOn(next);
    } catch (e) {
      reportError(e);
      setOn(false);
      setError(reason(e));
    } finally {
      setBusy(false);
    }
  }

  if (availability === null) return null;
  if (availability !== 'ready') {
    return (
      <Text variant="meta" tone="muted">
        {NOTES[availability]}
      </Text>
    );
  }
  return (
    <Stack gap="tight">
      <Switch label="Push notifications on this device" checked={on} loading={busy} onChange={(e) => void toggle(e.target.checked)} />
      {error ? (
        <Text variant="meta" tone="danger" role="alert">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
