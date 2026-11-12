'use client';
// Checkout form (G4, G25, G28): email, withdrawal waiver (must be ticked), optional
// marketing consent, order bump and coupon (G23). Then one of: total 0 = "Get access"; PayPal
// client id = PayPal buttons; no client id (dev fake provider) = "Pay (test)". The total shown
// here is display only: the server prices the order from DB rows. A recurring offer (G5) has
// no coupon or bump and pays through a PayPal subscription instead of an order.
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Checkbox, Field, Input, Stack, Text } from '@/components/ui/mds';
import { formatMoney, type Currency } from '@/lib/commerce/money';
import { priceTermsLabel, type RecurringTerms } from '@/lib/commerce/recurring';
import { WAIVER_TEXT } from '@/lib/commerce/waiver';
import { isEmail } from '@/lib/text/email';
import type { CompleteCheckoutState, StartCheckoutState } from '../actions';
import type { CheckoutInput, CouponPreview } from '../api/checkout';
import type { BumpInfo } from '../api/pricing';
import { CouponField, type AppliedCoupon } from './CouponField';
import { OrderSummary } from './OrderSummary';
import { PayPalButtons } from './PayPalButtons';
import styles from './CheckoutForm.module.css';

export type CheckoutFormProps = {
  offer: RecurringTerms & { slug: string; title: string; currency: Currency; bump: Omit<BumpInfo, 'id'> | null };
  /** PayPal REST client id of the space; null = dev fake provider. */
  clientId: string | null;
  locale: string;
  /** Kajabi shows the coupon box only when the offer has an active coupon. */
  couponField: boolean;
  applyCouponAction: (offerSlug: string, code: string) => Promise<CouponPreview>;
  startAction: (input: CheckoutInput) => Promise<StartCheckoutState>;
  completeAction: (offerSlug: string, providerOrderId: string) => Promise<CompleteCheckoutState>;
  activateAction: (offerSlug: string, providerSubscriptionId: string) => Promise<CompleteCheckoutState>;
};

const FAILED = 'Something went wrong. Please try again.';

export function CheckoutForm(props: CheckoutFormProps) {
  const { offer, clientId, locale, couponField, applyCouponAction, startAction } = props;
  const recurring = offer.kind !== 'one_time';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [waiver, setWaiver] = useState(false);
  const [consent, setConsent] = useState(false);
  const [withBump, setWithBump] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = isEmail(email.trim()) && waiver;
  const bump = withBump ? offer.bump : null;
  const lines = [{ label: offer.title, cents: offer.priceCents }];
  if (bump) lines.push({ label: bump.title, cents: bump.priceCents });
  if (coupon) lines.push({ label: `Coupon ${coupon.code}`, cents: -coupon.discountCents });
  const totalCents = lines.reduce((sum, l) => sum + l.cents, 0);
  const free = totalCents === 0;

  const input = (): CheckoutInput => ({
    offerSlug: offer.slug,
    email: email.trim(),
    waiverAccepted: waiver,
    marketingConsent: consent,
    couponCode: coupon?.code ?? '',
    withBump,
  });

  /** Creates the order or subscription; resolves its provider id, or null when done or refused. */
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
    return 'providerOrderId' in result ? result.providerOrderId : result.providerSubscriptionId;
  }

  async function finish(providerId: string): Promise<'done' | 'restart'> {
    const complete = recurring ? props.activateAction : props.completeAction;
    const result = await complete(offer.slug, providerId);
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
        mode={recurring ? 'subscription' : 'order'}
        create={async () => {
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
        {offer.bump ? (
          <Stack gap="hairline">
            <Checkbox
              name="bump"
              label={`Yes, add ${offer.bump.title} (${formatMoney(offer.bump.priceCents, offer.currency, locale)})`}
              checked={withBump}
              onChange={(e) => setWithBump(e.target.checked)}
            />
            {offer.bump.description ? <Text tone="secondary">{offer.bump.description}</Text> : null}
          </Stack>
        ) : null}
        {couponField ? <CouponField offerSlug={offer.slug} applied={coupon} onChange={setCoupon} applyAction={applyCouponAction} /> : null}
        <OrderSummary lines={lines} totalCents={totalCents} currency={offer.currency} locale={locale} />
        {recurring ? <Text tone="secondary">{priceTermsLabel(offer, locale)}</Text> : null}
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
