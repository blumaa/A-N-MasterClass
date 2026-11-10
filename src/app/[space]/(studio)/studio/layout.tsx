// Studio shell: guard (any studio section, G15) + side nav. Each action re-checks; this guard is UX.
import { notFound } from 'next/navigation';
import { NavLink } from '@/components/ui/links';
import { SideNav } from '@/components/ui/mds';
import { currentViewer } from '@/lib/auth/currentViewer';
import styles from './layout.module.css';
import { studioNav } from './nav';

export default async function StudioLayout({ children, params }: LayoutProps<'/[space]/studio'>) {
  const viewer = await currentViewer((await params).space);
  const nav = studioNav(viewer?.role ?? null);
  if (nav.length === 0) notFound();
  return (
    <div className={styles.layout}>
      <SideNav label="Studio">
        {nav.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} />
        ))}
      </SideNav>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
