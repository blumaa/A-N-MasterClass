// Member-authored text: mentions as names, http(s) links as safe external links.
// parseMentions is the XSS boundary (scheme allowlist); nothing here builds an href itself.
import { parseMentions } from '@/lib/mentions/markup';
import styles from './community.module.css';

export function MentionBody({ body }: { body: string }) {
  return (
    <p className={styles.body}>
      {parseMentions(body).map((segment, i) => {
        if (segment.type === 'mention') {
          return (
            <strong key={i} className={styles.mention}>
              @{segment.name}
            </strong>
          );
        }
        if (segment.type === 'link') {
          return (
            <a key={i} href={segment.href} target="_blank" rel="noopener noreferrer nofollow">
              {segment.label}
            </a>
          );
        }
        return segment.value;
      })}
    </p>
  );
}
