// Student/staff sign-in for this space (per host, G2). Fake data mode uses the dev switcher.
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { dataSource } from '@/config/dataSource';
import { Heading, Stack, Text } from '@/components/ui/mds';
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
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Sign in to {viewer.space.name}
      </Heading>
      <Text tone="secondary">Use the email you bought with. New here? Your account is made when you get access to a product.</Text>
      <SignInForm />
    </Stack>
  );
}
