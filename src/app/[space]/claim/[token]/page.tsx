// Account claim link from the receipt email (G4, 10 days, single use). The token is used up
// only by the form post, never by opening the page (mail scanners open links).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton/SubmitButton';
import { Text } from '@/components/ui/mds';
import { AuthPanel } from '@/features/auth/components/AuthPanel';
import { claimAccountAction } from '@/features/checkout/actions';
import { currentViewer } from '@/lib/auth/currentViewer';

export const metadata: Metadata = { title: 'Open your account', robots: { index: false } };

export default async function ClaimPage({ params, searchParams }: PageProps<'/[space]/claim/[token]'>) {
  const [{ space, token }, query] = await Promise.all([params, searchParams]);
  if (!(await currentViewer(space))) notFound();
  return (
    <AuthPanel title="Open your account">
      {query.error ? (
        <Text role="alert" tone="danger">
          This link has expired or was already used.
        </Text>
      ) : (
        <form action={claimAccountAction}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton>Continue to my account</SubmitButton>
        </form>
      )}
    </AuthPanel>
  );
}
