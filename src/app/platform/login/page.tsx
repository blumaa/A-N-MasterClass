// Platform admin sign-in (platform host cookies, G2).
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { platformSignInAction } from '@/features/auth/actions';
import { SignInForm } from '@/features/auth/components/SignInForm';
import { platformHomeHref } from '@/features/platform/paths';
import { sessionProfileId } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function PlatformSignInPage() {
  if (await sessionProfileId()) redirect(platformHomeHref);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Platform sign in
      </Heading>
      <SignInForm action={platformSignInAction} />
    </Stack>
  );
}
