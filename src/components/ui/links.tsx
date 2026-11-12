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

/** Button-styled link. `download` = file from a route handler: a plain <a download>, since
 *  client navigation cannot open a file. */
export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size,
  onMedia,
  download,
}: Common & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onMedia?: boolean;
  download?: boolean;
}) {
  // MDS types Button as a <button>; with `href` it renders an <a> and forwards the rest.
  const file = download ? { download: true } : {};
  return (
    <Button
      as={download ? undefined : NextLink}
      href={href}
      variant={variant}
      size={size}
      onMedia={onMedia}
      {...file}
    >
      {children}
    </Button>
  );
}

/** The one "go up a level" link on editor pages. `children` names the parent page. */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    // The span keeps the button its own width inside a stretching Stack.
    <span>
      <ButtonLink href={href} variant="ghost" size="sm">
        {`Back to ${children}`}
      </ButtonLink>
    </span>
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
