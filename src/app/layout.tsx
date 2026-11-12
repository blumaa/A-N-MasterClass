import type { Metadata } from 'next';
import '@mond-design-system/tokens/styles.css';
import '@mond-design-system/react/styles.css';
import '@/tokens/brand.css'; // last: brand wins by cascade order (MDS README)
import { Icons } from '@/components/Icons/Icons';
import { Toasts } from '@/components/Toasts/Toasts';
import { fontVariables } from '@/lib/fonts/nextFonts';

// Placeholder platform name (G17). Space routes override via generateMetadata.
export const metadata: Metadata = {
  title: 'masterclass',
  description: 'Programs, communities and coaching by independent instructors.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <Icons>
          <Toasts>{children}</Toasts>
        </Icons>
      </body>
    </html>
  );
}
