'use client';
// Space header: name, site nav and the visitor's account. Wide screens show the site links inline
// and the account in a popover; phones get one Menu button that opens a sheet with everything.
// The layout decides which links a viewer gets; this only arranges them.
import { useRef, useState, type ReactNode } from 'react';
import { AppLink, ButtonLink } from '@/components/ui/links';
import { Avatar, Badge, Button, Popover, PopoverBody, Sheet, SheetBody, SheetHeader, Text } from '@/components/ui/mds';
import type { NavItem } from '@/lib/data/types';
import styles from './SpaceHeader.module.css';

export type HeaderAccount = { displayName: string; unread: number; links: NavItem[] };

type Props = {
  spaceName: string;
  /** null while the space is hidden from this viewer: name only. */
  site: NavItem[] | null;
  account: HeaderAccount | null;
  signInHref: string | null;
  signOut: ReactNode;
};

function Links({ items, className }: { items: NavItem[]; className: string }) {
  return (
    <>
      {items.map((item) => (
        <span key={`${item.href}|${item.label}`} className={className}>
          <AppLink href={item.href} variant="plain">
            {item.label}
          </AppLink>
        </span>
      ))}
    </>
  );
}

function accountLabel(account: HeaderAccount): string {
  return account.unread > 0 ? `Account: ${account.displayName}, ${account.unread} unread` : `Account: ${account.displayName}`;
}

function AccountPopover({ account, signOut }: { account: HeaderAccount; signOut: ReactNode }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button ref={anchor} variant="ghost" size="sm" aria-expanded={open} aria-label={accountLabel(account)} onClick={() => setOpen((v) => !v)}>
        <Avatar name={account.displayName} size="sm" decorative />
        {account.unread > 0 ? <Badge tone="danger">{account.unread}</Badge> : null}
      </Button>
      <Popover open={open} onClose={close} anchorRef={anchor} label="Account" placement="bottom-end">
        <PopoverBody>
          {/* A click on any link inside navigates; close so the panel does not linger. */}
          <div className={styles.panel} onClick={close}>
            <Text variant="note" tone="muted">
              {account.displayName}
            </Text>
            <Links items={account.links} className={styles.row} />
            {signOut}
          </div>
        </PopoverBody>
      </Popover>
    </>
  );
}

function PhoneMenu({ site, account, signInHref, signOut }: Omit<Props, 'spaceName' | 'site'> & { site: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(true)}>
        Menu
      </Button>
      <Sheet open={open} onClose={close} label="Menu">
        <SheetHeader onClose={close} closeLabel="Close menu">
          Menu
        </SheetHeader>
        <SheetBody>
          <div className={styles.panel} onClick={close}>
            <Links items={site} className={styles.row} />
            {account ? <Links items={account.links} className={styles.row} /> : null}
            {account ? signOut : signInHref ? <ButtonLink href={signInHref}>Sign in</ButtonLink> : null}
          </div>
        </SheetBody>
      </Sheet>
    </>
  );
}

export function SpaceHeader({ spaceName, site, account, signInHref, signOut }: Props) {
  if (!site) {
    return (
      <header className={styles.header}>
        <Text as="span" className={styles.brand}>
          {spaceName}
        </Text>
      </header>
    );
  }
  return (
    <header className={styles.header}>
      <span className={styles.brand}>
        <AppLink href="/" variant="plain">
          {spaceName}
        </AppLink>
      </span>
      <nav aria-label="Main" className={styles.wide}>
        <Links items={site} className={styles.item} />
        {account ? (
          <AccountPopover account={account} signOut={signOut} />
        ) : signInHref ? (
          <ButtonLink href={signInHref} variant="secondary">
            Sign in
          </ButtonLink>
        ) : null}
      </nav>
      <div className={styles.narrow}>
        <PhoneMenu site={site} account={account} signInHref={signInHref} signOut={signOut} />
      </div>
    </header>
  );
}
