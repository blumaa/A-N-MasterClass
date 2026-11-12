'use client';
// The app's icon set, registered once at the root (MDS IconProvider: iconography is brand).
// Own stroke glyphs on a 24 grid, so no icon package. Add a name here before using it.
import type { ReactNode } from 'react';
import { IconProvider } from '@/components/ui/mds';
import styles from './Icons.module.css';

const GLYPHS: Record<string, string> = {
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  bold: 'M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8',
  italic: 'M19 4h-9M14 20H5M15 4 9 20',
  'heading-2': 'M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1',
  'heading-3': 'M4 12h8M4 18V6M12 18V6M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2',
  list: 'M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13',
  'list-ordered': 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  'text-quote': 'M17 6H3M21 12H8M21 18H8M3 12v6',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
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
