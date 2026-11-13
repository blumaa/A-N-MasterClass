// Public share page of a completion certificate (G26). Anyone with the link sees it; the member can
// turn the link off. Kept out of search engines; Open Graph tags give link previews.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { spaceMarks } from '@/features/branding/api/branding';
import { sharedCertificate } from '@/features/programs/api/certificateShare';
import { SharedCertificateCard } from '@/features/programs/components/SharedCertificateCard';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';

type Props = PageProps<'/[space]/certificates/[token]'>;

const load = cache(async (space: string, token: string) => {
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const repo = getRepo();
  const [certificate, marks] = await Promise.all([sharedCertificate(repo, viewer.space.id, token), spaceMarks(repo, viewer.space.id)]);
  if (!certificate) return null;
  return { spaceName: viewer.space.name, logoSrc: marks.logoPath ? siteImageSrc(marks.logoPath) : null, certificate };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { space, token } = await params;
  const data = await load(space, token);
  const robots = { index: false, follow: false };
  if (!data) return { robots };
  const { certificate, spaceName, logoSrc } = data;
  const title = `${certificate.memberName} completed ${certificate.programTitle}`;
  const description = `Certificate of completion from ${spaceName}.`;
  return {
    title,
    description,
    robots,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: spaceName,
      images: logoSrc ? [{ url: logoSrc, alt: spaceName }] : undefined,
    },
  };
}

export default async function SharedCertificatePage({ params }: Props) {
  const { space, token } = await params;
  const data = await load(space, token);
  if (!data) notFound();
  return <SharedCertificateCard {...data} />;
}
