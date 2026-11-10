import { describe, expect, it } from 'vitest';
import { podcastCommandFromForm } from './podcastsFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const parse = (fields: Record<string, string>) => podcastCommandFromForm(form(fields));

const EPISODE = {
  op: 'createEpisode',
  productId: 'p',
  title: 'Knots',
  type: 'full',
  season: '',
  showNotes: 'notes',
  audioPath: 'rope-talk/knots.mp3',
  audioBytes: '1000',
  durationS: '12:30',
  explicit: 'false',
  publishAt: '',
  timeZone: 'Europe/Berlin',
};

describe('podcastCommandFromForm', () => {
  it('reads a new podcast and show settings', () => {
    expect(parse({ op: 'createPodcast', title: 'Night Talks', slug: '' })).toEqual({
      ok: true,
      command: { op: 'createPodcast', title: 'Night Talks', slug: 'night-talks' },
    });
    expect(parse({ op: 'saveSettings', productId: 'p', author: 'A', explicit: 'true', order: 'serial' })).toEqual({
      ok: true,
      command: { op: 'saveSettings', productId: 'p', author: 'A', explicit: true, order: 'serial' },
    });
  });

  it('reads an episode; blank season and publish time mean none and draft', () => {
    expect(parse(EPISODE)).toEqual({
      ok: true,
      command: {
        op: 'createEpisode', productId: 'p', title: 'Knots', type: 'full', season: null, showNotes: 'notes',
        audioPath: 'rope-talk/knots.mp3', audioBytes: 1000, durationS: 750, explicit: false, publishAt: null,
      },
    });
    const scheduled = parse({ ...EPISODE, season: '2', publishAt: '2026-11-20T09:00' });
    expect(scheduled).toMatchObject({ command: { season: 2, publishAt: new Date('2026-11-20T08:00:00Z') } });
  });

  it('reads an episode patch with only the fields sent', () => {
    expect(parse({ op: 'updateEpisode', episodeId: 'e', publishAt: '', timeZone: 'Europe/Berlin' })).toEqual({
      ok: true,
      command: { op: 'updateEpisode', episodeId: 'e', patch: { publishAt: null } },
    });
    expect(parse({ op: 'updateEpisode', episodeId: 'e', title: 'New', season: '3' })).toEqual({
      ok: true,
      command: { op: 'updateEpisode', episodeId: 'e', patch: { title: 'New', season: 3 } },
    });
  });

  it('refuses bad input with a message', () => {
    expect(parse({ ...EPISODE, audioBytes: 'big' })).toMatchObject({ ok: false });
    expect(parse({ ...EPISODE, type: 'clip' })).toMatchObject({ ok: false });
  });
});
