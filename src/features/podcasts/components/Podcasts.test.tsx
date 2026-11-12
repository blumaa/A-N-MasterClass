import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/data/types';
import type { ClientEpisode, ClientPodcast as Data } from '../api/listen';
import type { StudioPodcast } from '../api/studio';
import { ClientPodcast } from './ClientPodcast';
import { StudioPodcasts } from './StudioPodcasts';

vi.mock('../actions', () => ({ editPodcastsAction: vi.fn(), resetFeedAction: vi.fn() }));
vi.mock('@/components/FileUpload/actions', () => ({ requestUploadAction: vi.fn() }));
vi.mock('@/components/ImageUpload/actions', () => ({ requestImageUploadAction: vi.fn() }));

const NOW = new Date('2026-11-10T12:00:00Z');
const product = { id: 'p1', slug: 'rope-talk', title: 'Rope Talk', subtitle: null, status: 'published' } as Product;
const episode = (over: Partial<ClientEpisode> = {}): ClientEpisode => ({
  id: 'e1',
  title: 'Welcome',
  type: 'full',
  season: null,
  showNotes: 'Hello listeners',
  audioBytes: 1_000_000,
  durationS: 750,
  explicit: false,
  publishAt: NOW,
  createdAt: NOW,
  released: true,
  ...over,
});
const data = (over: Partial<Data> = {}): Data => ({
  product,
  hasAccess: true,
  isEditor: false,
  settings: { productId: 'p1', author: 'Alexander', explicit: false, order: 'episodic' },
  episodes: [episode()],
  feedUrl: 'https://a.test/feeds/podcast/tok',
  ...over,
});

describe('ClientPodcast', () => {
  it('plays episodes through the audio route and shows the private feed', () => {
    const { container } = render(<ClientPodcast data={data()} />);
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByText(/12:30/)).toBeInTheDocument();
    expect(container.querySelector('audio')).toHaveAttribute('src', '/podcasts/rope-talk/episodes/e1/audio');
    expect(screen.getByLabelText('Private feed URL')).toHaveValue('https://a.test/feeds/podcast/tok');
    expect(screen.getByRole('button', { name: 'Reset feed URL' })).toBeInTheDocument();
  });

  it('tells visitors without access, and marks unreleased episodes for staff', () => {
    render(<ClientPodcast data={data({ hasAccess: false, episodes: [], feedUrl: null })} />);
    expect(screen.getByText(/do not have access/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Private feed URL')).toBeNull();
  });

  it('labels drafts and scheduled episodes in the staff preview', () => {
    const later = new Date('2026-12-01T09:00:00Z');
    render(
      <ClientPodcast
        data={data({ hasAccess: false, isEditor: true, feedUrl: null, episodes: [episode({ id: 'e2', released: false, publishAt: later }), episode({ id: 'e3', released: false, publishAt: null })] })}
      />,
    );
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});

describe('StudioPodcasts', () => {
  it('lists podcasts with their settings and episodes', () => {
    const p: StudioPodcast = {
      product,
      settings: { productId: 'p1', author: 'Alexander', explicit: false, order: 'serial' },
      episodes: [{ ...episode(), productId: 'p1', audioPath: 'p1/welcome.mp3' }],
    };
    render(<StudioPodcasts imageSrc={String} podcasts={[p]} />);
    expect(screen.getByDisplayValue('Rope Talk')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alexander')).toBeInTheDocument();
    expect(screen.getByText('Current file: welcome.mp3 · 1.0 MB')).toBeInTheDocument();
    expect(document.querySelector('input[type=hidden][name=audioPath]')).toHaveValue('p1/welcome.mp3');
    expect(screen.queryByRole('textbox', { name: /audio file path/i })).toBeNull();
    expect(screen.getByDisplayValue('12:30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add podcast' })).toBeInTheDocument();
  });

  it('leaves the page heading to the route and labels the add forms', () => {
    const p: StudioPodcast = { product, settings: { productId: 'p1', author: '', explicit: false, order: 'serial' }, episodes: [] };
    render(<StudioPodcasts imageSrc={String} podcasts={[p]} />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('heading', { name: 'New episode' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New podcast' })).toBeInTheDocument();
  });

  it('shows an empty state without podcasts', () => {
    render(<StudioPodcasts imageSrc={String} podcasts={[]} />);
    expect(screen.getByText('No podcasts yet')).toBeInTheDocument();
  });
});
