import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutForm, type CheckoutFormProps } from './CheckoutForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const offer = { slug: 'full', priceCents: 4900, currency: 'EUR' as const };

function setup(extra: Partial<CheckoutFormProps> = {}) {
  const props: CheckoutFormProps = {
    offer,
    clientId: null,
    startAction: vi.fn().mockResolvedValue({ ok: true, providerOrderId: 'po-1' }),
    completeAction: vi.fn().mockResolvedValue({ ok: true, next: '/checkout/full/thanks?status=paid' }),
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
    expect(props.startAction).toHaveBeenCalledWith({ offerSlug: 'full', email: 'Buyer@Test.com', waiverAccepted: true, marketingConsent: true });
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
});
