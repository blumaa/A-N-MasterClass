// Studio shell: capability guard (G15) + side nav. Each action re-checks; this guard is UX.
import { notFound } from 'next/navigation';
import { NavLink } from '@/components/ui/links';
import { SideNav } from '@/components/ui/mds';
import { studioSiteHref } from '@/features/site/paths';
import { studioBrandingHref, studioHref } from '@/features/studio/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { viewerCan } from '@/lib/auth/viewer';
import styles from './layout.module.css';

export default async function StudioLayout({ children, params }: LayoutProps<'/[space]/studio'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer || !viewerCan(viewer, 'products.edit')) notFound();
  return (
    <div className={styles.layout}>
      <SideNav label="Studio">
        <NavLink href={studioHref} label="Programs" />
        {viewerCan(viewer, 'site.edit') ? <NavLink href={studioSiteHref} label="Site" /> : null}
        {viewerCan(viewer, 'branding.manage') ? <NavLink href={studioBrandingHref} label="Branding" /> : null}
      </SideNav>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
