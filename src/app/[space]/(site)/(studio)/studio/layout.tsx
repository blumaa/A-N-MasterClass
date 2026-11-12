// Studio shell: guard (any studio section, G15) + side nav. Each action re-checks; this guard is UX.
import { notFound } from 'next/navigation';
import { NavLink } from '@/components/ui/links';
import { SideNav } from '@/components/ui/mds';
import { SectionLayout } from '@/components/SectionLayout/SectionLayout';
import { currentViewer } from '@/lib/auth/currentViewer';
import { studioNav } from './nav';

export default async function StudioLayout({ children, params }: LayoutProps<'/[space]/studio'>) {
  const viewer = await currentViewer((await params).space);
  const nav = studioNav(viewer?.role ?? null);
  if (nav.length === 0) notFound();
  return (
    <SectionLayout
      label="Studio"
      nav={
        <SideNav label="Studio">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </SideNav>
      }
    >
      {children}
    </SectionLayout>
  );
}
