// Space footer: instructor's footer links + published legal pages, always pinned (G25).
// Top row: space name and footer links. Bottom row: legal pages and the copyright line.
import { AppLink } from '@/components/ui/links';
import { Text } from '@/components/ui/mds';
import type { NavItem } from '@/lib/data/types';
import styles from './SiteFooter.module.css';

function Links({ label, items, className }: { label: string; items: NavItem[]; className: string }) {
  return items.length > 0 ? (
    <nav aria-label={label} className={className}>
      {items.map((item) => (
        <AppLink key={`${item.href}|${item.label}`} href={item.href} variant="plain">
          {item.label}
        </AppLink>
      ))}
    </nav>
  ) : null;
}

export function SiteFooter({ spaceName, links, legal }: { spaceName: string; links: NavItem[]; legal: NavItem[] }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <Text as="span" className={styles.name}>
          {spaceName}
        </Text>
        <Links label="Footer" items={links} className={styles.links} />
      </div>
      <div className={styles.bottom}>
        <Links label="Legal" items={legal} className={styles.legal} />
        <Text variant="note" tone="muted">
          © {spaceName}
        </Text>
      </div>
    </footer>
  );
}
