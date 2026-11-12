// Content blocks of an open step (G6). Video = Vimeo by id (G9). Download = plain anchor (full
// navigation) to the route that checks step access and redirects to a short-lived signed URL.
import { Heading, Link, Stack, Text } from '@/components/ui/mds';
import { VimeoEmbed } from '@/components/VimeoEmbed/VimeoEmbed';
import type { Part } from '@/lib/data/types';
import { fileType, formatBytes } from '@/lib/format/bytes';
import { vimeoPlayerUrl } from '@/lib/video/vimeo';
import { partFileHref } from '../paths';
import styles from './StepParts.module.css';

function DownloadBlock({ part, filePath, programSlug }: { part: Part; filePath: string; programSlug: string }) {
  const facts = [fileType(filePath), part.fileSize ? formatBytes(part.fileSize) : null].filter(Boolean).join(' · ');
  return (
    <div className={styles.download}>
      <Link variant="standalone" href={partFileHref(programSlug, part.stepId, part.id)}>
        {part.title ?? 'Download'}
      </Link>
      <Text tone="muted" variant="note">
        {facts}
      </Text>
    </div>
  );
}

function PartBlock({ part, programSlug }: { part: Part; programSlug: string }) {
  switch (part.kind) {
    case 'video':
      return part.vimeoId ? (
        <VimeoEmbed src={vimeoPlayerUrl(part.vimeoId)} title={part.title ?? 'Lesson video'} aspect={part.aspect ?? 16 / 9} />
      ) : null;
    case 'download':
      return part.filePath ? <DownloadBlock part={part} filePath={part.filePath} programSlug={programSlug} /> : null;
    default:
      return part.text ? <Text className={styles.text}>{part.text}</Text> : null;
  }
}

export function StepParts({ parts, programSlug }: { parts: Part[]; programSlug: string }) {
  return (
    <Stack gap="loose">
      {parts.map((part) => (
        <section key={part.id} aria-label={part.title ?? undefined}>
          {part.title && part.kind !== 'download' ? (
            <Heading level={3} variant="subtitle">
              {part.title}
            </Heading>
          ) : null}
          <PartBlock part={part} programSlug={programSlug} />
        </section>
      ))}
    </Stack>
  );
}
