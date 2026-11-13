// Public certificate page body (G26): the same words as the PDF, in the space theme.
import Image from 'next/image';
import { Heading, Stack, Text } from '@/components/ui/mds';
import type { SharedCertificate } from '@/lib/data/types';
import { formatDate } from '@/lib/format/date';
import styles from './SharedCertificateCard.module.css';

type Props = { spaceName: string; logoSrc: string | null; certificate: SharedCertificate };

export function SharedCertificateCard({ spaceName, logoSrc, certificate }: Props) {
  return (
    <article className={styles.card}>
      <Stack gap="loose" align="center">
        {logoSrc ? (
          <Image src={logoSrc} alt={spaceName} width={220} height={72} className={styles.logo} />
        ) : (
          <Text variant="label">{spaceName}</Text>
        )}
        <Heading level={1} variant="title">
          Certificate of completion
        </Heading>
        <Stack gap="tight" align="center">
          <Text tone="muted">This certifies that</Text>
          <Heading level={2} variant="subtitle">
            {certificate.memberName}
          </Heading>
          <Text tone="muted">has completed</Text>
          <Heading level={2} variant="subtitle">
            {certificate.programTitle}
          </Heading>
        </Stack>
        <Stack gap="tight" align="center">
          <Text>{formatDate(certificate.issuedAt)}</Text>
          <Text variant="note" tone="muted">{`Certificate ${certificate.serial}`}</Text>
        </Stack>
      </Stack>
    </article>
  );
}
