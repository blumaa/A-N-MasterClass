import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CouponsOverview } from './CouponsOverview';
import { coupon } from './fixtures';

vi.mock('../../studioActions', () => ({ editOfferAction: vi.fn(), editCouponAction: vi.fn(), savePaymentsAction: vi.fn() }));

const NOW = new Date('2026-11-12T12:00:00Z');

describe('CouponsOverview', () => {
  it('lists coupons with discount, offers, uses and state, linking to the editor', () => {
    const rows = [
      { coupon: coupon(), uses: 3 },
      { coupon: coupon({ id: 'c2', code: 'FIVE', percentOff: null, amountOffCents: 500, currency: 'EUR', maxUses: 10, active: false }), uses: 1 },
      { coupon: coupon({ id: 'c3', code: 'OLD', expiresAt: new Date('2026-11-01T00:00:00Z') }), uses: 0 },
    ];
    render(<CouponsOverview coupons={rows} locale="en" now={NOW} />);
    const first = screen.getByRole('link', { name: /SAVE10/ });
    expect(first).toHaveAttribute('href', '/studio/coupons/c1');
    expect(first).toHaveTextContent('10% off · 1 offer · 3 uses');
    expect(first).toHaveTextContent('Active');
    const second = screen.getByRole('link', { name: /FIVE/ });
    expect(second).toHaveTextContent('€5.00 off · 1 offer · 1 of 10 uses');
    expect(second).toHaveTextContent('Off');
    expect(screen.getByRole('link', { name: /OLD/ })).toHaveTextContent('Expired');
  });

  it('shows an empty state and a create form', () => {
    render(<CouponsOverview coupons={[]} locale="en" now={NOW} />);
    expect(screen.getByText('No coupons yet')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create coupon' })).toBeInTheDocument();
  });
});
