// Dev login switcher (DATA_SOURCE=fake, never production).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { devAuthAllowed } from '@/config/dataSource';
import { Heading, Stack, Text } from '@/components/ui/mds';
import { devProfiles } from '@/features/devAuth/api/devProfiles';
import { DevLoginList } from '@/features/devAuth/components/DevLoginList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Dev sign in' };

export default async function DevLoginPage({ params, searchParams }: PageProps<'/[space]/dev/login'>) {
  if (!devAuthAllowed(process.env)) notFound();
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  const [profiles, query] = await Promise.all([devProfiles(getRepo(), viewer.space), searchParams]);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Sign in as
      </Heading>
      <Text tone="muted">Fake data mode. Real sign-in arrives with Supabase Auth.</Text>
      {query.error ? (
        <Text role="alert" tone="danger">
          That profile cannot sign in here.
        </Text>
      ) : null}
      <DevLoginList profiles={profiles} />
    </Stack>
  );
}
