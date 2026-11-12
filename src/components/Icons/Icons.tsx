'use client';
// The app's icon set, registered once at the root (MDS IconProvider: iconography is brand).
// Own stroke glyphs on a 24 grid, so no icon package. Add a name here before using it.
import type { ReactNode } from 'react';
import { IconProvider } from '@/components/ui/mds';
import styles from './Icons.module.css';

const GLYPHS: Record<string, string> = {
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
};

function draw(name: string, { size }: { size?: number }) {
  const d = GLYPHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={size ? undefined : styles.glyph}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export function Icons({ children }: { children: ReactNode }) {
  return <IconProvider render={draw}>{children}</IconProvider>;
}
