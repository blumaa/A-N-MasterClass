import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CouponEditor } from './CouponEditor';
import { coupon } from './fixtures';

vi.mock('../../studioActions', () => ({ editOfferAction: vi.fn(), editCouponAction: vi.fn(), savePaymentsAction: vi.fn() }));

const NOW = new Date('2026-11-12T12:00:00Z');
const offers = [
  { id: 'o1', title: 'Full access', currency: 'EUR' as const },
  { id: 'o2', title: 'Workbook', currency: 'EUR' as const },
];

describe('CouponEditor', () => {
  it('prefills a percent coupon, its limits and its offers', () => {
    const c = coupon({ maxUses: 20, oncePerCustomer: true, expiresAt: new Date('2026-12-31T00:00:00Z') });
    render(<CouponEditor detail={{ coupon: c, uses: 4, offers }} now={NOW} />);
    expect(screen.getByLabelText('Code')).toHaveValue('SAVE10');
    expect(screen.getByLabelText('Discount type')).toHaveValue('percent');
    expect(screen.getByLabelText('Discount')).toHaveValue('10');
    expect(screen.queryByLabelText('Currency')).toBeNull();
    expect(screen.getByLabelText('Max uses')).toHaveValue('20');
    expect(screen.getByLabelText('Expires on')).toHaveValue('2026-12-31');
    expect(screen.getByLabelText('Once per customer (by email)')).toBeChecked();
    expect(screen.getByLabelText('Active')).toBeChecked();
    expect(screen.getByLabelText('Full access (EUR)')).toBeChecked();
    expect(screen.getByLabelText('Workbook (EUR)')).not.toBeChecked();
    expect(screen.getByText('Used 4 of 20 times')).toBeInTheDocument();
  });

  it('prefills an amount coupon as a decimal with its currency', () => {
    const c = coupon({ percentOff: null, amountOffCents: 550, currency: 'USD' });
    render(<CouponEditor detail={{ coupon: c, uses: 0, offers }} now={NOW} />);
    expect(screen.getByLabelText('Discount type')).toHaveValue('amount');
    expect(screen.getByLabelText('Discount')).toHaveValue('5.50');
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.getByRole('button', { name: 'Delete coupon' })).toBeInTheDocument();
  });

  it('shows the currency only once the discount is an amount', () => {
    render(<CouponEditor detail={{ coupon: coupon(), uses: 0, offers }} now={NOW} />);
    fireEvent.change(screen.getByLabelText('Discount type'), { target: { value: 'amount' } });
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR');
  });
});
