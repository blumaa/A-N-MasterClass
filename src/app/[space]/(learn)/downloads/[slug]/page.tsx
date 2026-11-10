// Client page of a download product: its files.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clientDownloads } from '@/features/downloads/api/files';
import { ClientDownloads } from '@/features/downloads/components/ClientDownloads';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/downloads/[slug]'>;

async function load(params: Props['params']) {
  const { space, slug } = await params;
  const viewer = await currentViewer(space);
  return viewer ? clientDownloads(getRepo(), viewer, slug, new Date()) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.product.title } : {};
}

export default async function DownloadsPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  return <ClientDownloads data={data} />;
}
