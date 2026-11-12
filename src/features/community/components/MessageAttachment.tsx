// The file on a chat line: images inline, other files as a link. The signed route checks access.
import { Text } from '@/components/ui/mds';
import { formatBytes } from '@/lib/format/bytes';
import type { AttachmentItem } from '../api/present';
import styles from './community.module.css';

export function MessageAttachment({ file }: { file: AttachmentItem }) {
  if (file.image) {
    return (
      <a href={file.href} target="_blank" rel="noreferrer">
        {/* Signed redirect to private storage: no next/image optimiser in between. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.href} alt={file.name} loading="lazy" className={styles.attachmentImage} />
      </a>
    );
  }
  return (
    <Text variant="note">
      <a href={file.href}>{file.name}</a> · {formatBytes(file.size)}
    </Text>
  );
}
