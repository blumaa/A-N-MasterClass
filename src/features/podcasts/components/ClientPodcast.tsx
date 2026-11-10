// Listener page of a podcast product (Kajabi Podcasts): episodes with an in-browser player, and
// the holder's private feed URL for podcast apps, which they can reset.
import { Badge, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import { formatDate } from '@/lib/format/date';
import { formatDuration } from '@/lib/format/duration';
import type { ClientEpisode, ClientPodcast as Data } from '../api/listen';
import { episodeAudioHref } from '../paths';
import { ResetFeedForm } from './forms';
import styles from './podcasts.module.css';

/** Staff preview only: why an episode is not out yet. */
const pending = (e: ClientEpisode): string | null => (e.released ? null : e.publishAt ? 'Scheduled' : 'Draft');

const meta = (e: ClientEpisode): string =>
  [e.publishAt ? formatDate(e.publishAt) : null, e.season !== null ? `Season ${e.season}` : null, e.durationS !== null ? formatDuration(e.durationS) : null]
    .filter(Boolean)
    .join(' · ');

function Episode({ episode: e, product }: { episode: ClientEpisode; product: string }) {
  const status = pending(e);
  return (
    <li className={styles.row}>
      <Heading level={2} variant="subtitle">
        {e.title}
      </Heading>
      <Text tone="muted" variant="note">
        {meta(e)}
      </Text>
      {status ? <Badge tone="neutral">{status}</Badge> : null}
      {e.type !== 'full' ? <Badge tone="accent">{e.type === 'bonus' ? 'Bonus' : 'Trailer'}</Badge> : null}
      <audio className={styles.audio} controls preload="none" src={episodeAudioHref(product, e.id)} />
      {e.showNotes ? <Text className={styles.notes}>{e.showNotes}</Text> : null}
    </li>
  );
}

function Feed({ url, productId }: { url: string; productId: string }) {
  return (
    <Stack gap="tight">
      <Field label="Private feed URL">
        <Input readOnly value={url} />
      </Field>
      <Text tone="muted" variant="note">
        Add this URL to your podcast app. It is yours alone; do not share it.
      </Text>
      <ResetFeedForm
        fields={{ productId }}
        submit="Reset feed URL"
        confirm="Podcast apps using the old URL stop updating. Reset?"
        inline
      />
    </Stack>
  );
}

export function ClientPodcast({ data }: { data: Data }) {
  const { product, hasAccess, isEditor, settings, episodes, feedUrl } = data;
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {product.title}
        </Heading>
        {product.subtitle ? <Text tone="muted">{product.subtitle}</Text> : null}
        {settings.author ? <Text variant="note">{`By ${settings.author}`}</Text> : null}
      </Stack>
      {feedUrl ? <Feed url={feedUrl} productId={product.id} /> : null}
      {!hasAccess ? <Text>{isEditor ? 'Staff preview: listeners with access hear released episodes.' : 'You do not have access to this podcast yet.'}</Text> : null}
      {hasAccess || isEditor ? (
        episodes.length === 0 ? (
          <Text tone="muted">No episodes yet.</Text>
        ) : (
          <ul aria-label="Episodes" className={styles.rows}>
            {episodes.map((e) => (
              <Episode key={e.id} episode={e} product={product.slug} />
            ))}
          </ul>
        )
      ) : null}
    </Stack>
  );
}
