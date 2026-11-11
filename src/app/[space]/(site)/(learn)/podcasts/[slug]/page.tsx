// Listener page of a podcast product: episodes, player, private feed URL.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { clientPodcast } from '@/features/podcasts/api/listen';
import { ClientPodcast } from '@/features/podcasts/components/ClientPodcast';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { requestOrigin } from '@/lib/tenancy/origin';

type Props = PageProps<'/[space]/podcasts/[slug]'>;

async function load(params: Props['params']) {
  const [{ space, slug }, h] = await Promise.all([params, headers()]);
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const origin = requestOrigin(h.get('host') ?? '', h.get('x-forwarded-proto'));
  return clientPodcast(getRepo(), viewer, slug, origin, new Date());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.product.title } : {};
}

export default async function PodcastPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  return <ClientPodcast data={data} />;
}
