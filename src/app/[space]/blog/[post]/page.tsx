// Published blog post at /blog/<slug> (G11).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadPost } from '@/features/site/api/load';
import { PublicPageView } from '@/features/site/components/PublicPageView';
import { pageMetadata } from '@/features/site/metadata';

type Props = PageProps<'/[space]/blog/[post]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { space, post } = await params;
  const found = await loadPost(space, post);
  return found ? pageMetadata(found.page) : {};
}

export default async function BlogPost({ params }: Props) {
  const { space, post } = await params;
  const found = await loadPost(space, post);
  if (!found) notFound();
  return <PublicPageView page={found.page} sections={found.sections} curricula={found.curricula} />;
}
