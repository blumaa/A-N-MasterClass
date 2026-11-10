// Space footer: instructor's footer links + published legal pages, always pinned (G25).
import { AppLink } from '@/components/ui/links';
import { Text } from '@/components/ui/mds';
import type { NavItem } from '@/lib/data/types';
import styles from './SiteFooter.module.css';

function Links({ label, items }: { label: string; items: NavItem[] }) {
  return items.length > 0 ? (
    <nav aria-label={label} className={styles.links}>
      {items.map((item) => (
        <AppLink key={`${item.href}|${item.label}`} href={item.href}>
          {item.label}
        </AppLink>
      ))}
    </nav>
  ) : null;
}

export function SiteFooter({ spaceName, links, legal }: { spaceName: string; links: NavItem[]; legal: NavItem[] }) {
  return (
    <footer className={styles.footer}>
      <Links label="Footer" items={links} />
      <Links label="Legal" items={legal} />
      <Text variant="meta" tone="muted">
        © {spaceName}
      </Text>
    </footer>
  );
}
