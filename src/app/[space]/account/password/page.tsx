// Set or change the password (G4: new buyers land here after checkout or a claim link).
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Heading, Stack, Text } from '@/components/ui/mds';
import { SetPasswordForm } from '@/features/auth/components/SetPasswordForm';
import { currentViewer } from '@/lib/auth/currentViewer';
import { signInHref } from '@/lib/routes';

export const metadata: Metadata = { title: 'Set your password', robots: { index: false } };

export default async function SetPasswordPage({ params }: PageProps<'/[space]/account/password'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  if (!viewer.profile) redirect(signInHref);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Set your password
      </Heading>
      <Text tone="secondary">You will use it with {viewer.profile.email} to sign in next time.</Text>
      <SetPasswordForm />
    </Stack>
  );
}
