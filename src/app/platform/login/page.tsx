// Platform admin sign-in (platform host cookies, G2).
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { platformSignInAction } from '@/features/auth/actions';
import { AuthPanel } from '@/features/auth/components/AuthPanel';
import { SignInForm } from '@/features/auth/components/SignInForm';
import { platformHomeHref } from '@/features/platform/paths';
import { sessionProfileId } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function PlatformSignInPage() {
  if (await sessionProfileId()) redirect(platformHomeHref);
  return (
    <AuthPanel title="Platform sign in">
      <SignInForm action={platformSignInAction} />
    </AuthPanel>
  );
}
