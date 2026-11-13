// Studio > Podcasts (G18, Kajabi Podcasts): podcast products, show settings and episodes.
// Audio uploads straight to Storage (FileUpload); the form saves the returned path and size.
// Publish times are typed in the chosen zone (shown in UTC); blank = draft, future = scheduled.
import { ChoiceSelect, TimeZoneSelect, YesNoSelect } from '@/components/fields/fields';
import { FileUpload } from '@/components/FileUpload/FileUpload';
import { ProductFields, type ImageSrc } from '@/components/ProductFields/ProductFields';
import { EmptyState, Field, Heading, Input, Stack, Textarea } from '@/components/ui/mds';
import { EPISODE_TYPES, PODCAST_ORDERS, type Episode, type EpisodeType, type PodcastOrder } from '@/lib/data/types';
import { formatDuration } from '@/lib/format/duration';
import { utcToZonedInput } from '@/lib/format/zoned';
import type { StudioPodcast } from '../api/studio';
import { PodcastForm } from './forms';
import styles from './podcasts.module.css';

const SHOWN_IN = 'UTC';
const TYPE_LABELS: Record<EpisodeType, string> = { full: 'Full episode', bonus: 'Bonus', trailer: 'Trailer' };
const ORDER_LABELS: Record<PodcastOrder, string> = { episodic: 'Episodic (newest first)', serial: 'Serial (oldest first)' };

function EpisodeFields({ productId, e }: { productId: string; e?: Episode }) {
  return (
    <>
      <Field label="Title">
        <Input name="title" defaultValue={e?.title ?? ''} required />
      </Field>
      <div className={styles.fields}>
        <ChoiceSelect name="type" label="Type" value={e?.type ?? 'full'} options={EPISODE_TYPES} labels={TYPE_LABELS} />
        <Field label="Season (optional)">
          <Input type="number" name="season" min={1} defaultValue={e?.season ?? ''} />
        </Field>
        <Field label="Length (h:mm:ss)">
          <Input name="durationS" defaultValue={e?.durationS != null ? formatDuration(e.durationS) : ''} />
        </Field>
        <YesNoSelect name="explicit" label="Explicit" value={e?.explicit ?? false} yes="Yes" no="No" />
      </div>
      <FileUpload
        productId={productId}
        kind="podcast"
        label={e ? 'Replace the audio' : 'Choose or drop the audio'}
        pathName="audioPath"
        sizeName="audioBytes"
        current={e ? { path: e.audioPath, bytes: e.audioBytes } : undefined}
      />
      <div className={styles.fields}>
        <Field label="Publish at (blank = draft)">
          <Input type="datetime-local" name="publishAt" defaultValue={e?.publishAt ? utcToZonedInput(e.publishAt, SHOWN_IN) : ''} />
        </Field>
        <TimeZoneSelect value={SHOWN_IN} />
      </div>
      <Field label="Show notes">
        <Textarea name="showNotes" rows={4} defaultValue={e?.showNotes ?? ''} />
      </Field>
    </>
  );
}

function Podcast({ podcast: { product: p, settings: s, episodes }, imageSrc }: { podcast: StudioPodcast; imageSrc: ImageSrc }) {
  return (
    <li className={styles.product}>
      <Heading level={2} variant="subtitle">
        {p.title}
      </Heading>
      <PodcastForm fields={{ op: 'updateProduct', productId: p.id }} submit="Save">
        <ProductFields product={p} imageSrc={imageSrc} />
      </PodcastForm>
      <PodcastForm fields={{ op: 'saveSettings', productId: p.id }} submit="Save show settings">
        <div className={styles.fields}>
          <Field label="Author">
            <Input name="author" defaultValue={s.author} />
          </Field>
          <ChoiceSelect name="order" label="Episode order" value={s.order} options={PODCAST_ORDERS} labels={ORDER_LABELS} />
          <YesNoSelect name="explicit" label="Explicit show" value={s.explicit} yes="Yes" no="No" />
        </div>
      </PodcastForm>
      <Heading level={3} variant="subtitle">
        Episodes
      </Heading>
      <ul aria-label={`Episodes of ${p.title}`} className={styles.rows}>
        {episodes.map((e) => (
          <li key={e.id} className={styles.row}>
            <PodcastForm fields={{ op: 'updateEpisode', episodeId: e.id }} submit="Save episode">
              <EpisodeFields productId={p.id} e={e} />
            </PodcastForm>
            <PodcastForm inline variant="ghost" submit="Delete episode" confirm={{ title: `Delete "${e.title}"?` }} fields={{ op: 'deleteEpisode', episodeId: e.id }} />
          </li>
        ))}
      </ul>
      <Heading level={3} variant="label">
        New episode
      </Heading>
      <PodcastForm fields={{ op: 'createEpisode', productId: p.id }} submit="Add episode">
        <EpisodeFields productId={p.id} />
      </PodcastForm>
    </li>
  );
}

export function StudioPodcasts({ podcasts, imageSrc }: { podcasts: StudioPodcast[]; imageSrc: ImageSrc }) {
  return (
    <Stack gap="loose">
      {podcasts.length === 0 ? (
        <EmptyState title="No podcasts yet" />
      ) : (
        <ul aria-label="Podcasts" className={styles.rows}>
          {podcasts.map((p) => (
            <Podcast key={p.product.id} podcast={p} imageSrc={imageSrc} />
          ))}
        </ul>
      )}
      <Heading level={2} variant="label">
        New podcast
      </Heading>
      <PodcastForm fields={{ op: 'createPodcast' }} submit="Add podcast">
        <Field label="Title">
          <Input name="title" required />
        </Field>
        <Field label="Slug (optional)">
          <Input name="slug" />
        </Field>
      </PodcastForm>
    </Stack>
  );
}
