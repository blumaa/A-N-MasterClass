'use client';
// Space sign-out. First removes this browser's push subscription (server row + browser) while the
// session still owns it, so a shared device stops getting this account's pushes.
// The platform host never serves a push worker, so its sign-out stays a plain form.
import { Button } from '@/components/ui/mds';
import { signOutAction } from '@/features/auth/actions';
import { reportError } from '@/lib/errors/report';
import { leavePush } from '@/lib/push/browserPush';
import { pushServer } from './pushServer';

async function signOut(): Promise<void> {
  // Sign-out must not wait on push: a failure is reported, and PushHeal drops what is left on
  // the next signed-out or other-account page load.
  await leavePush(pushServer).catch(reportError);
  await signOutAction();
}

export function SignOutForm() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
