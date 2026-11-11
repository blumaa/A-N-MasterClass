// Platform host shell (G1, G17): platform admin only. Sign out when signed in.
import type { Metadata } from 'next';
import { AppLink } from '@/components/ui/links';
import { Button, Container } from '@/components/ui/mds';
import { signOutAction } from '@/features/auth/actions';
import { platformHomeHref } from '@/features/platform/paths';
import { sessionProfileId } from '@/lib/auth/session';
import styles from './layout.module.css';

export const metadata: Metadata = { title: { default: 'Platform', template: '%s · Platform' }, robots: { index: false } };

export default async function PlatformLayout({ children }: LayoutProps<'/platform'>) {
  const signedIn = Boolean(await sessionProfileId());
  return (
    <>
      <header className={styles.header}>
        <AppLink href={platformHomeHref}>Platform</AppLink>
        {signedIn ? (
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        ) : null}
      </header>
      <Container width="wide">
        <main className={styles.main}>{children}</main>
      </Container>
    </>
  );
}
