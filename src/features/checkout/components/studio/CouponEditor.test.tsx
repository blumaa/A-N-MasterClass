import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CouponEditor } from './CouponEditor';
import { coupon } from './fixtures';

vi.mock('../../studioActions', () => ({ editOfferAction: vi.fn(), editCouponAction: vi.fn(), savePaymentsAction: vi.fn() }));

const NOW = new Date('2026-11-12T12:00:00Z');
const offers = [
  { id: 'o1', title: 'Full access', slug: 'full', currency: 'EUR' as const },
  { id: 'o2', title: 'Workbook', slug: 'workbook', currency: 'EUR' as const },
];
/** The <dd> next to a report label. */
const stat = (label: string) => screen.getByText(label).closest('dt')!.nextElementSibling;
const noReport = { uses: 0, customers: 0, totals: [], orders: [] };
const report = {
  uses: 4,
  customers: 3,
  totals: [{ currency: 'EUR' as const, revenueCents: 8820, discountCents: 980 }],
  orders: [
    {
      id: 'or1',
      email: 'a@test',
      offerTitle: 'Full access',
      amountCents: 4410,
      discountCents: 490,
      currency: 'EUR' as const,
      status: 'paid' as const,
      livemode: false,
      createdAt: new Date('2026-11-04T10:00:00Z'),
    },
  ],
};

describe('CouponEditor', () => {
  it('prefills a percent coupon, its limits and its offers', () => {
    const c = coupon({ maxUses: 20, oncePerCustomer: true, expiresAt: new Date('2026-12-31T00:00:00Z') });
    render(<CouponEditor detail={{ coupon: c, report, offers }} now={NOW} locale="en" />);
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
    render(<CouponEditor detail={{ coupon: c, report: noReport, offers }} now={NOW} locale="en" />);
    expect(screen.getByLabelText('Discount type')).toHaveValue('amount');
    expect(screen.getByLabelText('Discount')).toHaveValue('5.50');
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.getByRole('button', { name: 'Delete coupon' })).toBeInTheDocument();
  });

  it('shows the currency only once the discount is an amount', () => {
    render(<CouponEditor detail={{ coupon: coupon(), report: noReport, offers }} now={NOW} locale="en" />);
    fireEvent.change(screen.getByLabelText('Discount type'), { target: { value: 'amount' } });
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR');
  });

  it('reports uses, customers, live money and the orders that used the coupon', () => {
    render(<CouponEditor detail={{ coupon: coupon(), report, offers }} now={NOW} locale="en" />);
    expect(stat('Uses')).toHaveTextContent('4');
    expect(stat('Customers')).toHaveTextContent('3');
    expect(stat('Revenue')).toHaveTextContent('€88.20');
    expect(stat('Discount given')).toHaveTextContent('€9.80');
    const row = within(screen.getByRole('table', { name: 'Orders with this coupon' })).getByText('a@test').closest('tr')!;
    expect(row).toHaveTextContent('Full access');
    expect(row).toHaveTextContent('€44.10');
    expect(row).toHaveTextContent('€4.90');
    expect(within(row).getByText('Test')).toBeInTheDocument();
  });

  it('says when no order used the coupon yet', () => {
    render(<CouponEditor detail={{ coupon: coupon(), report: noReport, offers }} now={NOW} locale="en" />);
    expect(screen.getByText('No orders used this coupon yet.')).toBeInTheDocument();
  });

  it('gives a checkout link with the coupon applied for each linked offer', () => {
    render(<CouponEditor detail={{ coupon: coupon(), report: noReport, offers }} now={NOW} locale="en" />);
    expect(screen.getByRole('link', { name: '/checkout/full?coupon_code=SAVE10' })).toHaveAttribute('href', '/checkout/full?coupon_code=SAVE10');
    expect(screen.queryByRole('link', { name: /workbook/ })).toBeNull();
  });
});
