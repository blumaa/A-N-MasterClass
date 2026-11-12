// Space shell: runtime theme, header (site nav, library, studio for staff, notifications, sign in/out),
// footer with site links + legal pages (G11, G25). A draft space shows only its name to visitors
// who cannot see it yet; its pages are gated in (site)/layout.tsx, login and claim stay open.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppLink } from "@/components/ui/links";
import { Button, Container, Text } from "@/components/ui/mds";
import { spaceTheme } from "@/features/branding/api/branding";
import { ThemeStyle } from "@/features/branding/components/ThemeStyle";
import { themeCss } from "@/features/branding/theme";
import { notificationsHref } from "@/features/community/paths";
import { unreadCount } from "@/features/community/api/notifications";
import { signOutAction } from "@/features/auth/actions";
import { libraryHref } from "@/features/programs/paths";
import { siteChrome } from "@/features/site/api/site";
import { SiteFooter } from "@/features/site/components/SiteFooter";
import { studioHref } from "@/features/studio/paths";
import { currentViewer } from "@/lib/auth/currentViewer";
import { sessionsEnabled } from "@/lib/auth/session";
import { canSeeSpace, viewerCan } from "@/lib/auth/viewer";
import { getRepo } from "@/lib/data/getRepo";
import { pushPublicKey } from "@/lib/push/getPushSender";
import { signInHref } from "@/lib/routes";
import styles from "./layout.module.css";
import { PushHeal } from "./PushHeal";

export async function generateMetadata({
  params,
}: LayoutProps<"/[space]">): Promise<Metadata> {
  const viewer = await currentViewer((await params).space);
  return viewer
    ? {
        title: {
          default: viewer.space.name,
          template: `%s · ${viewer.space.name}`,
        },
        manifest: "/manifest.webmanifest",
      }
    : {};
}

export default async function SpaceLayout({
  children,
  params,
}: LayoutProps<"/[space]">) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  const sessions = sessionsEnabled();
  const repo = getRepo();
  const visible = canSeeSpace(viewer);
  const pushKey = viewer.profile ? pushPublicKey() : null;
  const [theme, chrome, unread] = await Promise.all([
    spaceTheme(repo, viewer.space.id),
    visible ? siteChrome(repo, viewer.space.id) : null,
    unreadCount(repo, viewer),
  ]);
  return (
    <>
      <ThemeStyle css={themeCss(theme, "space")} />
      {viewer.profile && pushKey ? (
        <PushHeal key={viewer.profile.id} publicKey={pushKey} />
      ) : null}
      <header className={styles.header}>
        {chrome ? (
          <AppLink href="/">{viewer.space.name}</AppLink>
        ) : (
          <Text as="span">{viewer.space.name}</Text>
        )}
        {chrome ? (
          <nav aria-label="Main" className={styles.nav}>
            {chrome.header.map((item) => (
              <AppLink key={`${item.href}|${item.label}`} href={item.href}>
                {item.label}
              </AppLink>
            ))}
            <AppLink href={libraryHref}>Library</AppLink>
            {viewerCan(viewer, "products.edit") ? (
              <AppLink href={studioHref}>Studio</AppLink>
            ) : null}
            {viewer.profile ? (
              <>
                <AppLink href={notificationsHref}>
                  {unread > 0 ? `Notifications (${unread})` : "Notifications"}
                </AppLink>
                <Text as="span" variant="meta" tone="muted">
                  {viewer.displayName}
                </Text>
                {sessions ? (
                  <form action={signOutAction}>
                    <Button type="submit" variant="ghost" size="sm">
                      Sign out
                    </Button>
                  </form>
                ) : null}
              </>
            ) : sessions ? (
              <AppLink href={signInHref}>Sign in</AppLink>
            ) : null}
          </nav>
        ) : null}
      </header>
      <Container width="wide">
        <main className={styles.main}>{children}</main>
      </Container>
      {chrome ? (
        <SiteFooter
          spaceName={viewer.space.name}
          links={chrome.footer}
          legal={chrome.legal}
        />
      ) : null}
    </>
  );
}
