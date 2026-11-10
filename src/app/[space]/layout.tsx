// Space shell: runtime theme, header with library, studio (staff only), dev login switcher (fake data only).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { devAuthAllowed } from '@/config/dataSource';
import { AppLink } from '@/components/ui/links';
import { Button, Container, Text } from '@/components/ui/mds';
import { spaceTheme } from '@/features/branding/api/branding';
import { ThemeStyle } from '@/features/branding/components/ThemeStyle';
import { themeCss } from '@/features/branding/theme';
import { devSignOutAction } from '@/features/devAuth/actions';
import { libraryHref } from '@/features/programs/paths';
import { studioHref } from '@/features/studio/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { viewerCan } from '@/lib/auth/viewer';
import { getRepo } from '@/lib/data/getRepo';
import styles from './layout.module.css';

export async function generateMetadata({ params }: LayoutProps<'/[space]'>): Promise<Metadata> {
  const viewer = await currentViewer((await params).space);
  return viewer ? { title: { default: viewer.space.name, template: `%s · ${viewer.space.name}` }, manifest: '/manifest.webmanifest' } : {};
}

export default async function SpaceLayout({ children, params }: LayoutProps<'/[space]'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  const devAuth = devAuthAllowed(process.env);
  const theme = await spaceTheme(getRepo(), viewer.space.id);
  return (
    <>
      <ThemeStyle css={themeCss(theme, 'space')} />
      <header className={styles.header}>
        <AppLink href="/">{viewer.space.name}</AppLink>
        <nav aria-label="Main" className={styles.nav}>
          <AppLink href={libraryHref}>Library</AppLink>
          {viewerCan(viewer, 'products.edit') ? <AppLink href={studioHref}>Studio</AppLink> : null}
          {viewer.profile ? (
            <>
              <Text as="span" variant="meta" tone="muted">
                {viewer.displayName}
              </Text>
              {devAuth ? (
                <form action={devSignOutAction}>
                  <Button type="submit" variant="ghost" size="sm">
                    Sign out
                  </Button>
                </form>
              ) : null}
            </>
          ) : devAuth ? (
            <AppLink href="/dev/login">Sign in</AppLink>
          ) : null}
        </nav>
      </header>
      <Container width="wide">
        <main className={styles.main}>{children}</main>
      </Container>
    </>
  );
}
