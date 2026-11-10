// Content blocks of an open step (G6). Video = Vimeo by id (G9). Downloads wait for storage.
import { Badge, Heading, Stack, Text } from '@/components/ui/mds';
import { VimeoEmbed } from '@/components/VimeoEmbed/VimeoEmbed';
import type { Part } from '@/lib/data/types';
import { vimeoPlayerUrl } from '@/lib/video/vimeo';
import styles from './StepParts.module.css';

function PartBlock({ part }: { part: Part }) {
  switch (part.kind) {
    case 'video':
      return part.vimeoId ? (
        <VimeoEmbed src={vimeoPlayerUrl(part.vimeoId)} title={part.title ?? 'Lesson video'} aspect={part.aspect ?? 16 / 9} />
      ) : null;
    case 'download':
      // OWES: signed URL from private `resources` bucket (needs Supabase Storage).
      return (
        <div className={styles.download}>
          <Text as="span">{part.title ?? part.filePath ?? 'Download'}</Text>
          <Badge tone="neutral">Download available once storage is connected</Badge>
        </div>
      );
    default:
      return part.text ? <Text className={styles.text}>{part.text}</Text> : null;
  }
}

export function StepParts({ parts }: { parts: Part[] }) {
  return (
    <Stack gap="loose">
      {parts.map((part) => (
        <section key={part.id} aria-label={part.title ?? undefined}>
          {part.title && part.kind !== 'download' ? (
            <Heading level={3} variant="subtitle">
              {part.title}
            </Heading>
          ) : null}
          <PartBlock part={part} />
        </section>
      ))}
    </Stack>
  );
}
