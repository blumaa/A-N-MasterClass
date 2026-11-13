import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutForm, type CheckoutFormProps } from './CheckoutForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const offer = {
  slug: 'full',
  title: 'Full',
  priceCents: 4900,
  currency: 'EUR' as const,
  kind: 'one_time' as const,
  billingInterval: null,
  trialDays: null,
  installments: null,
  bump: null,
};
const bump = { title: 'Extra', description: 'Bonus lessons', priceCents: 900 };

function setup(extra: Partial<CheckoutFormProps> = {}) {
  const props: CheckoutFormProps = {
    offer,
    clientId: null,
    locale: 'en',
    couponField: false,
    applyCouponAction: vi.fn().mockResolvedValue({ ok: true, code: 'TEN', discountCents: 490 }),
    startAction: vi.fn().mockResolvedValue({ ok: true, providerOrderId: 'po-1' }),
    completeAction: vi.fn().mockResolvedValue({ ok: true, next: '/checkout/full/thanks?status=paid' }),
    activateAction: vi.fn().mockResolvedValue({ ok: true, next: '/checkout/full/thanks?status=welcome' }),
    ...extra,
  };
  render(<CheckoutForm {...props} />);
  return props;
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const tick = (name: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name }));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

function fill(email = 'Buyer@Test.com') {
  type('Email', email);
  tick(/right of withdrawal/);
}

beforeEach(() => push.mockReset());

describe('CheckoutForm', () => {
  it('keeps the pay button off until email and waiver are given', async () => {
    setup();
    const pay = screen.getByRole('button', { name: 'Pay (test)' });
    expect(pay).toBeDisabled();
    type('Email', 'buyer@test.com');
    expect(pay).toBeDisabled();
    tick(/right of withdrawal/);
    expect(pay).toBeEnabled();
  });

  it('test payment starts, completes and goes to the thank-you page', async () => {
    const props = setup();
    fill();
    tick(/news/);
    press('Pay (test)');
    expect(props.startAction).toHaveBeenCalledWith({
      offerSlug: 'full',
      email: 'Buyer@Test.com',
      waiverAccepted: true,
      marketingConsent: true,
      couponCode: '',
      withBump: false,
    });
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(props.completeAction).toHaveBeenCalledWith('full', 'po-1');
    expect(push).toHaveBeenCalledWith('/checkout/full/thanks?status=paid');
  });

  it('a free offer fulfils on start without a payment step', async () => {
    const start = vi.fn().mockResolvedValue({ ok: true, next: '/checkout/free/thanks?status=paid' });
    const props = setup({ offer: { ...offer, priceCents: 0 }, startAction: start });
    fill();
    press('Get access');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/checkout/free/thanks?status=paid'));
    expect(props.completeAction).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/checkout/free/thanks?status=paid');
  });

  it('shows the server message and stays on the page', async () => {
    setup({ startAction: vi.fn().mockResolvedValue({ ok: false, message: 'Payments are not set up for this site yet.' }) });
    fill();
    press('Pay (test)');
    expect(await screen.findByRole('alert')).toHaveTextContent('Payments are not set up');
    expect(push).not.toHaveBeenCalled();
  });

  it('with a PayPal client id asks for the details before showing PayPal', () => {
    setup({ clientId: 'cid' });
    expect(screen.queryByRole('button', { name: 'Pay (test)' })).not.toBeInTheDocument();
    expect(screen.getByText(/Enter your email and confirm/)).toBeInTheDocument();
  });

  it('offers the bump, adds it to the total and sends it (G23)', async () => {
    const props = setup({ offer: { ...offer, bump } });
    expect(screen.getByText('Bonus lessons')).toBeInTheDocument();
    expect(screen.getByTestId('total')).toHaveTextContent('€49.00');
    tick(/Extra/);
    expect(screen.getByTestId('total')).toHaveTextContent('€58.00');
    fill();
    press('Pay (test)');
    expect(props.startAction).toHaveBeenCalledWith(expect.objectContaining({ withBump: true }));
  });

  it('applies a coupon, shows the discount and sends the code (G23)', async () => {
    const props = setup({ couponField: true });
    type('Coupon code', 'ten');
    press('Apply');
    expect(await screen.findByText(/TEN applied/)).toBeInTheDocument();
    expect(props.applyCouponAction).toHaveBeenCalledWith('full', 'ten');
    expect(screen.getByTestId('total')).toHaveTextContent('€44.10');
    fill();
    press('Pay (test)');
    expect(props.startAction).toHaveBeenCalledWith(expect.objectContaining({ couponCode: 'TEN' }));
    press('Remove');
    expect(screen.getByTestId('total')).toHaveTextContent('€49.00');
  });

  it('shows the pay and apply buttons busy while their requests run', async () => {
    let started: (v: Awaited<ReturnType<CheckoutFormProps['startAction']>>) => void = () => {};
    let applied: (v: Awaited<ReturnType<CheckoutFormProps['applyCouponAction']>>) => void = () => {};
    setup({
      couponField: true,
      startAction: vi.fn<CheckoutFormProps['startAction']>(() => new Promise((resolve) => (started = resolve))),
      applyCouponAction: vi.fn<CheckoutFormProps['applyCouponAction']>(() => new Promise((resolve) => (applied = resolve))),
    });
    type('Coupon code', 'ten');
    press('Apply');
    expect(await screen.findByRole('button', { name: /Apply/, busy: true })).toBeInTheDocument();
    applied({ ok: true, code: 'TEN', discountCents: 490 });
    await screen.findByText(/TEN applied/);
    fill();
    press('Pay (test)');
    expect(await screen.findByRole('button', { name: /Pay \(test\)/, busy: true })).toBeInTheDocument();
    started({ ok: false, message: 'stop' });
    await screen.findByRole('alert');
  });

  it('shows a refused coupon', async () => {
    setup({ couponField: true, applyCouponAction: vi.fn().mockResolvedValue({ ok: false, message: 'This coupon code is not valid.' }) });
    type('Coupon code', 'nope');
    press('Apply');
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid');
  });

  it('starts with the coupon from the checkout link applied, and it can be removed', async () => {
    const props = setup({ couponField: true, linkCoupon: { code: 'ten', result: { ok: true, code: 'TEN', discountCents: 490 } } });
    expect(screen.getByText(/TEN applied/)).toBeInTheDocument();
    expect(screen.getByTestId('total')).toHaveTextContent('€44.10');
    fill();
    press('Pay (test)');
    expect(props.startAction).toHaveBeenCalledWith(expect.objectContaining({ couponCode: 'TEN' }));
    press('Remove');
    expect(screen.getByTestId('total')).toHaveTextContent('€49.00');
  });

  it('shows why a coupon from the checkout link did not apply, with the code filled in', () => {
    setup({ couponField: true, linkCoupon: { code: 'nope', result: { ok: false, message: 'This coupon code is not valid.' } } });
    expect(screen.getByLabelText('Coupon code')).toHaveValue('nope');
    expect(screen.getByRole('alert')).toHaveTextContent('not valid');
    expect(screen.getByTestId('total')).toHaveTextContent('€49.00');
  });

  it('has no coupon field unless the offer has an active coupon', () => {
    setup();
    expect(screen.queryByLabelText('Coupon code')).not.toBeInTheDocument();
  });

  it('a fully discounted order needs no payment', async () => {
    setup({ couponField: true, applyCouponAction: vi.fn().mockResolvedValue({ ok: true, code: 'ALL', discountCents: 4900 }) });
    type('Coupon code', 'all');
    press('Apply');
    expect(await screen.findByRole('button', { name: 'Get access' })).toBeInTheDocument();
  });

  it('a subscription shows its terms and activates after approval (G5)', async () => {
    const monthly = { ...offer, kind: 'subscription' as const, priceCents: 1500, billingInterval: 'month' as const, trialDays: 7 };
    const props = setup({ offer: monthly, startAction: vi.fn().mockResolvedValue({ ok: true, providerSubscriptionId: 'I-1' }) });
    expect(screen.getByText('7-day free trial, then €15.00 per month')).toBeInTheDocument();
    fill();
    press('Pay (test)');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/checkout/full/thanks?status=welcome'));
    expect(props.activateAction).toHaveBeenCalledWith('full', 'I-1');
    expect(props.completeAction).not.toHaveBeenCalled();
  });
});
