'use client';
// Studio side nav. Client side so the current section follows the URL across layout reuse.
import { usePathname } from 'next/navigation';
import { NavLink } from '@/components/ui/links';
import { SideNav } from '@/components/ui/mds';
import { activeNavHref } from './nav';

type Item = { href: string; label: string };

export function StudioNav({ items }: { items: readonly Item[] }) {
  const active = activeNavHref(usePathname(), items.map((i) => i.href));
  return (
    <SideNav label="Studio">
      {items.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} active={item.href === active} />
      ))}
    </SideNav>
  );
}
