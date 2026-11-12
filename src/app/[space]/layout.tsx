// Space shell: runtime theme, viewer time zone cookie (client-facing times), header (site nav,
// library, studio for staff, notifications, sign in/out), footer with site links + legal pages
// (G11, G25). A draft space shows only its name to visitors who cannot see it yet; its pages are
// gated in (site)/layout.tsx, login and claim stay open.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/mds";
import { ViewerZoneScript } from "@/components/ViewerZoneScript/ViewerZoneScript";
import { spaceMarks, spaceTheme } from "@/features/branding/api/branding";
import { ThemeStyle } from "@/features/branding/components/ThemeStyle";
import { themeCss } from "@/features/branding/theme";
import { notificationsHref } from "@/features/community/paths";
import { unreadCount } from "@/features/community/api/notifications";
import { libraryHref } from "@/features/programs/paths";
import { siteChrome } from "@/features/site/api/site";
import { SiteFooter } from "@/features/site/components/SiteFooter";
import { studioHref } from "@/features/studio/paths";
import { currentViewer } from "@/lib/auth/currentViewer";
import { sessionsEnabled } from "@/lib/auth/session";
import { canSeeSpace, viewerCan } from "@/lib/auth/viewer";
import { getRepo } from "@/lib/data/getRepo";
import { pushPublicKey } from "@/lib/push/getPushSender";
import { siteImageSrc } from "@/lib/storage/siteImageSrc";
import { accountHref, accountSubscriptionsHref, signInHref } from "@/lib/routes";
import styles from "./layout.module.css";
import { PushHeal } from "./PushHeal";
import { SignOutForm } from "./SignOutForm";
import { SpaceHeader } from "./SpaceHeader";

export async function generateMetadata({
  params,
}: LayoutProps<"/[space]">): Promise<Metadata> {
  const viewer = await currentViewer((await params).space);
  if (!viewer) return {};
  const { faviconPath } = await spaceMarks(getRepo(), viewer.space.id);
  const icon = faviconPath ? siteImageSrc(faviconPath) : "/brand-icon.svg";
  return {
    title: {
      default: viewer.space.name,
      template: `%s · ${viewer.space.name}`,
    },
    manifest: "/manifest.webmanifest",
    icons: { icon, apple: faviconPath ? icon : undefined },
  };
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
  const pushKey = pushPublicKey();
  const [theme, marks, chrome, unread] = await Promise.all([
    spaceTheme(repo, viewer.space.id),
    spaceMarks(repo, viewer.space.id),
    visible ? siteChrome(repo, viewer.space.id) : null,
    unreadCount(repo, viewer),
  ]);
  return (
    <div className={styles.shell}>
      <ThemeStyle css={themeCss(theme, "space")} />
      <ViewerZoneScript />
      {pushKey ? (
        <PushHeal publicKey={pushKey} profileId={viewer.profile?.id ?? null} />
      ) : null}
      <SpaceHeader
        spaceName={viewer.space.name}
        logoSrc={marks.logoPath ? siteImageSrc(marks.logoPath) : null}
        site={chrome ? chrome.header : null}
        account={
          viewer.profile
            ? {
                displayName: viewer.displayName,
                avatarSrc: viewer.avatarPath ? siteImageSrc(viewer.avatarPath) : null,
                unread,
                links: [
                  { label: "Library", href: libraryHref },
                  ...(viewerCan(viewer, "products.edit")
                    ? [{ label: "Studio", href: studioHref }]
                    : []),
                  {
                    label: unread > 0 ? `Notifications (${unread})` : "Notifications",
                    href: notificationsHref,
                  },
                  { label: "Account", href: accountHref },
                  { label: "Subscriptions", href: accountSubscriptionsHref },
                ],
              }
            : null
        }
        signInHref={sessions ? signInHref : null}
        signOut={sessions ? <SignOutForm /> : null}
      />
      <div className={styles.page}>
        <Container width="wide">
          <main className={styles.main}>{children}</main>
        </Container>
      </div>
      {chrome ? (
        <SiteFooter
          spaceName={viewer.space.name}
          links={chrome.footer}
          legal={chrome.legal}
        />
      ) : null}
    </div>
  );
}
