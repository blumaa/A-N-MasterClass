// Published builder page at /<slug> (G11). Reserved slugs never reach here (static routes win).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadPage } from '@/features/site/api/load';
import { PublicPageView } from '@/features/site/components/PublicPageView';
import { pageMetadata } from '@/features/site/metadata';

type Props = PageProps<'/[space]/[page]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { space, page } = await params;
  const found = await loadPage(space, page);
  return found ? pageMetadata(found.page) : {};
}

export default async function SitePage({ params }: Props) {
  const { space, page } = await params;
  const found = await loadPage(space, page);
  if (!found) notFound();
  return <PublicPageView page={found.page} sections={found.sections} refs={found.refs} />;
}
