// Studio > Podcasts (G18, Kajabi Podcasts): podcast products, show settings and episodes.
// Audio is given as a storage path + size until upload is built (docs/PLAN.md, Launch 5 owes).
// Publish times are typed in the chosen zone (shown in UTC); blank = draft, future = scheduled.
import { ChoiceSelect, TimeZoneSelect, YesNoSelect } from '@/components/fields/fields';
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';
import { EmptyState, Field, Heading, Input, Stack, Textarea } from '@/components/ui/mds';
import { EPISODE_MAX_BYTES, EPISODE_TYPES, PODCAST_ORDERS, type Episode, type EpisodeType, type PodcastOrder } from '@/lib/data/types';
import { formatDuration } from '@/lib/format/duration';
import { utcToZonedInput } from '@/lib/format/zoned';
import type { StudioPodcast } from '../api/studio';
import { PodcastForm } from './forms';
import styles from './podcasts.module.css';

const SHOWN_IN = 'UTC';
const TYPE_LABELS: Record<EpisodeType, string> = { full: 'Full episode', bonus: 'Bonus', trailer: 'Trailer' };
const ORDER_LABELS: Record<PodcastOrder, string> = { episodic: 'Episodic (newest first)', serial: 'Serial (oldest first)' };

function EpisodeFields({ e }: { e?: Episode }) {
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
      <div className={styles.fields}>
        <Field label="Audio file path (.mp3)">
          <Input name="audioPath" defaultValue={e?.audioPath ?? ''} required />
        </Field>
        <Field label="File size (bytes)">
          <Input type="number" name="audioBytes" min={1} max={EPISODE_MAX_BYTES} defaultValue={e?.audioBytes ?? ''} required />
        </Field>
      </div>
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

function Podcast({ podcast: { product: p, settings: s, episodes } }: { podcast: StudioPodcast }) {
  return (
    <li className={styles.row}>
      <Heading level={2} variant="subtitle">
        {p.title}
      </Heading>
      <PodcastForm fields={{ op: 'updateProduct', productId: p.id }} submit="Save">
        <Field label="Title">
          <Input name="title" defaultValue={p.title} required />
        </Field>
        <Field label="Subtitle">
          <Input name="subtitle" defaultValue={p.subtitle ?? ''} />
        </Field>
        <StatusSelect value={p.status} />
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
              <EpisodeFields e={e} />
            </PodcastForm>
            <PodcastForm inline variant="danger" submit="Delete episode" confirm={`Delete "${e.title}"?`} fields={{ op: 'deleteEpisode', episodeId: e.id }} />
          </li>
        ))}
      </ul>
      <PodcastForm fields={{ op: 'createEpisode', productId: p.id }} submit="Add episode">
        <EpisodeFields />
      </PodcastForm>
    </li>
  );
}

export function StudioPodcasts({ podcasts }: { podcasts: StudioPodcast[] }) {
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Podcasts
      </Heading>
      {podcasts.length === 0 ? (
        <EmptyState title="No podcasts yet" />
      ) : (
        <ul aria-label="Podcasts" className={styles.rows}>
          {podcasts.map((p) => (
            <Podcast key={p.product.id} podcast={p} />
          ))}
        </ul>
      )}
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
