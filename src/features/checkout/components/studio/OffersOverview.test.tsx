import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { offer } from './fixtures';
import { OffersOverview } from './OffersOverview';

vi.mock('../../studioActions', () => ({ editOfferAction: vi.fn(), savePaymentsAction: vi.fn() }));

describe('OffersOverview', () => {
  it('lists offers with price, product count, sales and status, linking to the editor', () => {
    render(<OffersOverview offers={[{ offer: offer(), productCount: 2, sold: 3 }]} locale="en" />);
    const row = screen.getByRole('link', { name: /Full access/ });
    expect(row).toHaveAttribute('href', '/studio/offers/o1');
    expect(row).toHaveTextContent('€49.95 · 2 products · 3 sold');
    expect(row).toHaveTextContent('Draft');
  });

  it('shows an empty state and a create form', () => {
    render(<OffersOverview offers={[]} locale="en" />);
    expect(screen.getByText('No offers yet')).toBeInTheDocument();
    expect(screen.getByLabelText('Price')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create offer' })).toBeInTheDocument();
  });
});
