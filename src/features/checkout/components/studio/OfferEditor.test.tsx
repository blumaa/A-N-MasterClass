import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfferEditor } from './OfferEditor';
import { offer } from './fixtures';

vi.mock('../../studioActions', () => ({ editOfferAction: vi.fn(), savePaymentsAction: vi.fn() }));

const detail = (over = {}) => ({
  offer: offer(over),
  productIds: ['p1'],
  products: [
    { id: 'p1', title: 'Shibari 101', kind: 'program' as const },
    { id: 'p2', title: 'Circle', kind: 'community' as const },
  ],
});

describe('OfferEditor', () => {
  it('prefills settings with the price as a decimal', () => {
    render(<OfferEditor detail={detail()} />);
    expect(screen.getByLabelText('Price')).toHaveValue('49.95');
    expect(screen.getByLabelText('Address')).toHaveValue('full');
  });

  it('ticks linked products', () => {
    render(<OfferEditor detail={detail()} />);
    expect(screen.getByLabelText('Shibari 101 (program)')).toBeChecked();
    expect(screen.getByLabelText('Circle (community)')).not.toBeChecked();
  });

  it('draft: offers publish, no checkout link', () => {
    render(<OfferEditor detail={detail()} />);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /checkout/i })).toBeNull();
  });

  it('published: shows the checkout link and unpublish', () => {
    render(<OfferEditor detail={detail({ status: 'published' })} />);
    expect(screen.getByRole('link', { name: '/checkout/full' })).toHaveAttribute('href', '/checkout/full');
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
  });
});
