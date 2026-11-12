// "X is typing…" line. The live region stays mounted (empty when nobody types) so screen
// readers hear changes; fixed height so the chat does not jump.
import { Text } from '@mond-design-system/react';
import styles from './TypingIndicator.module.css';

export function TypingIndicator({ line }: { line: string }) {
  return (
    <Text variant="note" tone="muted" aria-live="polite" className={styles.line}>
      {line}
    </Text>
  );
}
