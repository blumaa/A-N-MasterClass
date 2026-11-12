import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionRow } from '../api/subscriptionRows';
import { MemberSubscriptions } from './MemberSubscriptions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const END = new Date('2026-12-10T12:00:00Z');

const row = (extra: Partial<SubscriptionRow>): SubscriptionRow => ({
  id: 'sub-1',
  email: 'me@test.com',
  offerTitle: 'Monthly',
  terms: {
    kind: 'subscription',
    priceCents: 1500,
    currency: 'EUR',
    billingInterval: 'month',
    trialDays: null,
    installments: null,
  },
  status: 'active',
  paymentsMade: 1,
  currentPeriodEnd: END,
  endedAt: null,
  livemode: true,
  createdAt: END,
  cancellable: true,
  ...extra,
});

beforeEach(() => refresh.mockReset());

describe('MemberSubscriptions', () => {
  it('says so when there are none', () => {
    render(<MemberSubscriptions rows={[]} locale="en" cancelAction={vi.fn()} />);
    expect(screen.getByText('You have no subscriptions.')).toBeInTheDocument();
  });

  it('shows terms, status and the end date of a cancelled subscription, without a cancel button', () => {
    render(
      <MemberSubscriptions
        rows={[row({ status: 'cancelled', endedAt: END, cancellable: false })]}
        locale="en"
        cancelAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByText('€15.00 per month')).toBeInTheDocument();
    expect(screen.getByText(/cancelled · access until 12\/10\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('asks to confirm, cancels, then reloads the page', async () => {
    const cancelAction = vi.fn().mockResolvedValue('cancelled');
    render(<MemberSubscriptions rows={[row({})]} locale="en" cancelAction={cancelAction} />);
    expect(screen.getByText(/active · renews 12\/10\/2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(cancelAction).not.toHaveBeenCalled();
    expect(screen.getByText(/You keep access until 12\/10\/2026/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' })));
    expect(cancelAction).toHaveBeenCalledWith('sub-1');
    expect(refresh).toHaveBeenCalled();
    const region = screen.getByRole('region', { name: 'Status messages' });
    expect(within(region).getByText('Subscription cancelled')).toBeInTheDocument();
  });

  it('clears an earlier error when the cancel is tried again', async () => {
    const cancelAction = vi.fn().mockResolvedValueOnce('not_cancellable');
    let finish: (v: string) => void = () => {};
    cancelAction.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<MemberSubscriptions rows={[row({})]} locale="en" cancelAction={cancelAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' })));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' })));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: /Yes, cancel/, busy: true })).toBeInTheDocument();
    await act(async () => finish('cancelled'));
  });

  it('shows an error when the cancel is refused', async () => {
    const cancelAction = vi.fn().mockResolvedValue('not_cancellable');
    render(<MemberSubscriptions rows={[row({})]} locale="en" cancelAction={cancelAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' })));
    expect(screen.getByRole('alert')).toHaveTextContent('could not be cancelled');
    expect(refresh).not.toHaveBeenCalled();
  });
});
