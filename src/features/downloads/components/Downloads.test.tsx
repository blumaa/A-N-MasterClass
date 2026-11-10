import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/data/types';
import type { ClientDownloads as Data } from '../api/files';
import { ClientDownloads } from './ClientDownloads';
import { StudioDownloads } from './StudioDownloads';

vi.mock('../actions', () => ({ editDownloadsAction: vi.fn() }));

const NOW = new Date('2026-11-10T12:00:00Z');
const product = { id: 'p1', slug: 'pattern-pack', title: 'Pattern Pack', subtitle: null, status: 'published' } as Product;
const data = (over: Partial<Data> = {}): Data => ({
  product,
  hasAccess: true,
  isEditor: false,
  files: [{ id: 'f1', title: 'Hip harness', type: 'PDF', size: '2.4 MB' }],
  ...over,
});

describe('ClientDownloads', () => {
  it('links each file to the download route with its type and size', () => {
    render(<ClientDownloads data={data()} />);
    expect(screen.getByRole('link', { name: 'Hip harness' })).toHaveAttribute('href', '/downloads/pattern-pack/files/f1');
    expect(screen.getByText('PDF · 2.4 MB')).toBeInTheDocument();
  });

  it('tells visitors without access', () => {
    render(<ClientDownloads data={data({ hasAccess: false, files: [] })} />);
    expect(screen.getByText(/do not have access/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Files' })).toBeNull();
  });
});

describe('StudioDownloads', () => {
  it('lists products with their files', () => {
    const files = [{ id: 'f1', productId: 'p1', title: 'Hip harness', filePath: 'pattern-pack/hip.pdf', sizeBytes: 2_400_000, createdAt: NOW }];
    render(<StudioDownloads downloads={[{ product, files }]} />);
    expect(screen.getByDisplayValue('Pattern Pack')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hip harness')).toBeInTheDocument();
    expect(screen.getByText('pattern-pack/hip.pdf · PDF · 2.4 MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add download' })).toBeInTheDocument();
  });

  it('shows an empty state without downloads', () => {
    render(<StudioDownloads downloads={[]} />);
    expect(screen.getByText('No downloads yet')).toBeInTheDocument();
  });
});
