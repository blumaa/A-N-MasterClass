'use client';
// Section shell (studio, community, step outline): side nav beside the content on wide screens. Phones get one
// button named after the section that opens the same nav in a sheet, so the content comes
// first instead of a long link list.
import { useState, type ReactNode } from 'react';
import { Button, Sheet, SheetBody, SheetHeader } from '@/components/ui/mds';
import styles from './SectionLayout.module.css';

type Props = {
  /** Section name, shown on the phone button and as the sheet title. */
  label: string;
  nav: ReactNode;
  /** Wider side column, for a program outline instead of a link list. */
  wide?: boolean;
  children: ReactNode;
};

export function SectionLayout({ label, nav, wide, children }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className={wide ? `${styles.layout} ${styles.wide}` : styles.layout}>
      <aside className={styles.side}>{nav}</aside>
      <div className={styles.narrow}>
        <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(true)}>
          {label}
        </Button>
        <Sheet open={open} onClose={close} label={label}>
          <SheetHeader onClose={close} closeLabel="Close">
            {label}
          </SheetHeader>
          <SheetBody>
            <div onClick={close}>{nav}</div>
          </SheetBody>
        </Sheet>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
