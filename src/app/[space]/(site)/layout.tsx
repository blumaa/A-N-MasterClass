// Gate for the site, library and studio of a space: a draft or archived space is visible only to
// its staff and platform admins (canSeeSpace). Chrome lives in the parent [space] layout.
import { notFound } from 'next/navigation';
import { currentViewer } from '@/lib/auth/currentViewer';
import { canSeeSpace } from '@/lib/auth/viewer';

export default async function SiteLayout({ children, params }: LayoutProps<'/[space]'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer || !canSeeSpace(viewer)) notFound();
  return children;
}
