// Member's own account in this space: profile form, links to password and subscriptions, data export and delete (G25).
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AppLink } from '@/components/ui/links';
import { Heading, Stack } from '@/components/ui/mds';
import { deleteAccountAction, saveProfileAction } from '@/features/account/actions';
import { myProfile } from '@/features/account/api/profile';
import { ProfileForm } from '@/features/account/components/ProfileForm';
import { YourData } from '@/features/account/components/YourData';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { accountDataHref, accountSubscriptionsHref, setPasswordHref, signInHref } from '@/lib/routes';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';

export const metadata: Metadata = { title: 'Account', robots: { index: false } };

export default async function AccountPage({ params }: PageProps<'/[space]/account'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  if (!viewer.profile) redirect(signInHref);
  const profile = await myProfile(getRepo(), viewer);
  if (!profile) redirect(signInHref);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Account
      </Heading>
      <ProfileForm action={saveProfileAction} profile={profile} imageSrc={siteImageSrc} />
      <Stack gap="tight">
        <AppLink href={setPasswordHref}>Change password</AppLink>
        <AppLink href={accountSubscriptionsHref}>Subscriptions</AppLink>
      </Stack>
      <YourData
        exportHref={accountDataHref}
        deleteAction={deleteAccountAction}
        spaceName={viewer.space.name}
        canDelete={viewer.role !== 'owner'}
      />
    </Stack>
  );
}
