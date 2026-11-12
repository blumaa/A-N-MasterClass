import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfferEditor } from './OfferEditor';
import { offer } from './fixtures';

vi.mock('../../studioActions', () => ({ editOfferAction: vi.fn(), savePaymentsAction: vi.fn() }));

const detail = (over = {}) => ({
  offer: offer(over),
  items: [
    { productId: 'p1', accessGroupId: null },
    { productId: 'p3', accessGroupId: 'g-vip' },
  ],
  products: [
    { id: 'p1', title: 'Shibari 101', kind: 'program' as const, groups: [] },
    { id: 'p2', title: 'Circle', kind: 'community' as const, groups: [] },
    { id: 'p3', title: 'Inner circle', kind: 'community' as const, groups: [{ id: 'g-vip', title: 'VIP' }] },
  ],
  others: [
    { id: 'o2', title: 'Workbook', currency: 'EUR' as const, status: 'published' as const, kind: 'one_time' as const },
    { id: 'o3', title: 'Dollar pack', currency: 'USD' as const, status: 'draft' as const, kind: 'one_time' as const },
    { id: 'o4', title: 'Monthly', currency: 'EUR' as const, status: 'published' as const, kind: 'subscription' as const },
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
    expect(screen.getByLabelText('Shibari 101 (Program)')).toBeChecked();
    expect(screen.getByLabelText('Circle (Community)')).not.toBeChecked();
  });

  it('offers an access group pick only for communities with extra groups', () => {
    render(<OfferEditor detail={detail()} />);
    expect(screen.getByLabelText('Access group in Inner circle')).toHaveValue('g-vip');
    expect(screen.queryByLabelText('Access group in Circle')).toBeNull();
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

  it('picks a bump of the same currency and any upsell offer (G23)', () => {
    render(<OfferEditor detail={detail({ bumpOfferId: 'o2' })} />);
    const bump = screen.getByLabelText('Order bump');
    expect(bump).toHaveValue('o2');
    expect(within(bump).queryByRole('option', { name: /Dollar pack/ })).toBeNull();
    const upsell = screen.getByLabelText('Upsell');
    expect(upsell).toHaveValue('');
    expect(within(upsell).getByRole('option', { name: 'Dollar pack (draft)' })).toBeInTheDocument();
  });

  it('bumps only one-time offers (G5)', () => {
    render(<OfferEditor detail={detail()} />);
    expect(within(screen.getByLabelText('Order bump')).queryByRole('option', { name: 'Monthly' })).toBeNull();
    expect(within(screen.getByLabelText('Upsell')).getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
  });

  it('one-time offer: price type one-time, empty recurring fields', () => {
    render(<OfferEditor detail={detail()} />);
    expect(screen.getByLabelText('Price type')).toHaveValue('one_time');
    expect(screen.getByLabelText('Trial days')).toHaveValue('');
    expect(screen.getByLabelText('Number of payments')).toHaveValue('');
  });

  it('subscription: prefills interval and trial, no order bump (G5)', () => {
    const terms = { kind: 'subscription' as const, billingInterval: 'year' as const, trialDays: 14 };
    render(<OfferEditor detail={detail(terms)} />);
    expect(screen.getByLabelText('Price type')).toHaveValue('subscription');
    expect(screen.getByLabelText('Billing interval')).toHaveValue('year');
    expect(screen.getByLabelText('Trial days')).toHaveValue('14');
    expect(screen.queryByLabelText('Order bump')).toBeNull();
    expect(screen.getByLabelText('Upsell')).toBeInTheDocument();
  });

  it('payment plan: prefills the number of payments', () => {
    render(<OfferEditor detail={detail({ kind: 'payment_plan', billingInterval: 'month', installments: 3 })} />);
    expect(screen.getByLabelText('Price type')).toHaveValue('payment_plan');
    expect(screen.getByLabelText('Number of payments')).toHaveValue('3');
  });
});
