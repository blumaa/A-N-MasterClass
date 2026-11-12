// Platform > one space: owner claim link, status, domains (G1).
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { platformSpace } from '@/features/platform/api/spaces';
import { SpaceDetail } from '@/features/platform/components/SpaceDetail';
import { getRepo } from '@/lib/data/getRepo';
import { headersOrigin, spaceOrigin } from '@/lib/tenancy/origin';
import { requirePlatformAdmin } from '../../guard';

export default async function PlatformSpacePage({ params }: PageProps<'/platform/spaces/[slug]'>) {
  await requirePlatformAdmin();
  const detail = await platformSpace(getRepo(), (await params).slug);
  if (!detail) notFound();
  const h = await headers();
  const spaceUrl = spaceOrigin(headersOrigin(h), detail.space.slug);
  return <SpaceDetail detail={detail} spaceUrl={spaceUrl} />;
}
