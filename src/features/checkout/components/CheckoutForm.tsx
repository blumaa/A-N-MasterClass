'use client';
// Checkout form (G4, G25, G28): email, withdrawal waiver (must be ticked), optional
// marketing consent. Then one of: free = "Get access"; PayPal client id = PayPal buttons;
// no client id (dev fake provider) = "Pay (test)". Price always comes from the server.
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Checkbox, Field, Input, Stack, Text } from '@/components/ui/mds';
import type { Currency } from '@/lib/commerce/money';
import { WAIVER_TEXT } from '@/lib/commerce/waiver';
import { isEmail } from '@/lib/text/email';
import type { CompleteCheckoutState, StartCheckoutState } from '../actions';
import { PayPalButtons } from './PayPalButtons';
import styles from './CheckoutForm.module.css';

export type CheckoutFormProps = {
  offer: { slug: string; priceCents: number; currency: Currency };
  /** PayPal REST client id of the space; null = dev fake provider. */
  clientId: string | null;
  startAction: (input: { offerSlug: string; email: string; waiverAccepted: boolean; marketingConsent: boolean }) => Promise<StartCheckoutState>;
  completeAction: (offerSlug: string, providerOrderId: string) => Promise<CompleteCheckoutState>;
};

const FAILED = 'Something went wrong. Please try again.';

export function CheckoutForm({ offer, clientId, startAction, completeAction }: CheckoutFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [waiver, setWaiver] = useState(false);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = isEmail(email.trim()) && waiver;
  const free = offer.priceCents === 0;

  const input = () => ({ offerSlug: offer.slug, email: email.trim(), waiverAccepted: waiver, marketingConsent: consent });

  /** Creates the order; resolves the provider order id, or null when done or refused. */
  async function begin(): Promise<string | null> {
    setMessage(null);
    const result = await startAction(input());
    if (!result.ok) {
      setMessage(result.message);
      return null;
    }
    if ('next' in result) {
      router.push(result.next);
      return null;
    }
    return result.providerOrderId;
  }

  async function finish(providerOrderId: string): Promise<'done' | 'restart'> {
    const result = await completeAction(offer.slug, providerOrderId);
    if (result.ok) {
      router.push(result.next);
      return 'done';
    }
    setMessage(result.message);
    return result.retry ? 'restart' : 'done';
  }

  function payDirect() {
    startTransition(async () => {
      const id = await begin();
      if (id) await finish(id);
    });
  }

  function payment() {
    if (free || !clientId) {
      return (
        <Button type="button" disabled={!ready || pending} onClick={payDirect}>
          {free ? 'Get access' : 'Pay (test)'}
        </Button>
      );
    }
    if (!ready) return <Text tone="secondary">Enter your email and confirm the waiver to see the payment options.</Text>;
    return (
      <PayPalButtons
        clientId={clientId}
        currency={offer.currency}
        createOrder={async () => {
          const id = await begin();
          // PayPal needs an order id or a rejection; a refusal message is already shown.
          if (!id) throw new Error('checkout refused');
          return id;
        }}
        onApprove={finish}
        onError={() => setMessage((m) => m ?? FAILED)}
      />
    );
  }

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <Stack gap="base">
        <Field label="Email">
          <Input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Checkbox name="waiver" label={WAIVER_TEXT} checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
        <Checkbox
          name="marketingConsent"
          label="Send me news and offers by email (optional)."
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        {message ? (
          <div role="alert">
            <Text tone="danger" variant="note">
              {message}
            </Text>
          </div>
        ) : null}
        {payment()}
      </Stack>
    </form>
  );
}
