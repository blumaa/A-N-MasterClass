// Student/staff sign-in for this space (per host, G2). Fake data mode uses the dev switcher.
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { dataSource } from '@/config/dataSource';
import { AuthPanel } from '@/features/auth/components/AuthPanel';
import { SignInForm } from '@/features/auth/components/SignInForm';
import { currentViewer } from '@/lib/auth/currentViewer';
import { devSignInHref, libraryHref } from '@/lib/routes';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function SignInPage({ params }: PageProps<'/[space]/login'>) {
  if (dataSource() !== 'supabase') redirect(devSignInHref);
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  if (viewer.profile) redirect(libraryHref);
  return (
    <AuthPanel
      title={`Sign in to ${viewer.space.name}`}
      intro="Use the email you bought with. New here? Your account is made when you get access to a product."
    >
      <SignInForm />
    </AuthPanel>
  );
}
