'use client';
// MDS polymorphic `as` takes a component; functions cannot cross the server/client
// boundary, so NextLink is bound here.
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { Button, Link, ListItem, SideNavItem } from '@mond-design-system/react';

type Common = { href: string; children: ReactNode };

export function AppLink({
  href,
  children,
  variant,
  current,
}: Common & { variant?: 'inline' | 'standalone' | 'plain'; current?: boolean }) {
  return (
    <Link as={NextLink} href={href} variant={variant} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  onMedia,
}: Common & { variant?: 'primary' | 'secondary' | 'ghost'; onMedia?: boolean }) {
  return (
    <Button as={NextLink} href={href} variant={variant} onMedia={onMedia}>
      {children}
    </Button>
  );
}

export function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return <SideNavItem as={NextLink} href={href} label={label} active={active} />;
}

export function LinkRow({
  href,
  title,
  description,
  trailing,
}: {
  href: string;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
}) {
  return <ListItem as={NextLink} href={href} title={title} description={description} trailing={trailing} />;
}
