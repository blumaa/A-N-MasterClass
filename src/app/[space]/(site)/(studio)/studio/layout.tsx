// Studio shell: guard (any studio section, G15) + side nav. Each action re-checks; this guard is UX.
import { notFound } from 'next/navigation';
import { SectionLayout } from '@/components/SectionLayout/SectionLayout';
import { currentViewer } from '@/lib/auth/currentViewer';
import { studioNav } from './nav';
import { StudioNav } from './StudioNav';

export default async function StudioLayout({ children, params }: LayoutProps<'/[space]/studio'>) {
  const viewer = await currentViewer((await params).space);
  const nav = studioNav(viewer?.role ?? null);
  if (nav.length === 0) notFound();
  return (
    <SectionLayout
      label="Studio"
      nav={<StudioNav items={nav.map(({ href, label }) => ({ href, label }))} />}
    >
      {children}
    </SectionLayout>
  );
}
