'use client';
// Member account: own subscriptions and payment plans, with self-cancel (G5). Kajabi lets a
// customer cancel and keep access until the end of the paid period:
// https://help.kajabi.com/en/articles/17175348-cancel-a-customer-s-subscription
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Card, CardBody, Heading, Inline, Stack, Text } from '@/components/ui/mds';
import { priceTermsLabel } from '@/lib/commerce/recurring';
import type { SubscriptionRow } from '../api/subscriptionRows';
import type { CancelOutcome } from '../api/subscriptions';
import { subscriptionStatusLabel } from './subscriptionLabels';

type Props = {
  rows: SubscriptionRow[];
  locale: string;
  cancelAction: (subscriptionId: string) => Promise<CancelOutcome>;
};

const day = (d: Date | null, locale: string) => (d ? d.toLocaleDateString(locale) : '');

function statusLine(s: SubscriptionRow, locale: string): string {
  const status = subscriptionStatusLabel(s.status);
  if (s.status === 'cancelled') return `${status} · access until ${day(s.endedAt, locale)}`;
  if ((s.status === 'active' || s.status === 'past_due') && s.currentPeriodEnd) {
    const next = s.terms.kind === 'payment_plan' ? 'next payment' : 'renews';
    return `${status} · ${next} ${day(s.currentPeriodEnd, locale)}`;
  }
  return status;
}

export function MemberSubscriptions({ rows, locale, cancelAction }: Props) {
  if (rows.length === 0) return <Text tone="secondary">You have no subscriptions.</Text>;
  return (
    <Stack gap="base">
      {rows.map((s) => (
        <Card key={s.id}>
          <CardBody>
            <Stack gap="tight">
              <Heading level={2} variant="subtitle">
                {s.offerTitle}
              </Heading>
              <Text>{priceTermsLabel(s.terms, locale)}</Text>
              <Text variant="note" tone="secondary">
                {statusLine(s, locale)}
              </Text>
              {s.cancellable ? <CancelButton row={s} locale={locale} cancelAction={cancelAction} /> : null}
            </Stack>
          </CardBody>
        </Card>
      ))}
    </Stack>
  );
}

function CancelButton({ row, locale, cancelAction }: { row: SubscriptionRow } & Omit<Props, 'rows'>) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const outcome = await cancelAction(row.id);
      if (outcome === 'cancelled') router.refresh();
      else setFailed(true);
    });
  }

  if (!confirming) {
    return (
      <Inline gap="tight">
        <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          Cancel subscription
        </Button>
      </Inline>
    );
  }
  return (
    <Stack gap="tight">
      <Text variant="note">
        You keep access until {day(row.currentPeriodEnd, locale)}. No further payments are taken.
      </Text>
      <Inline gap="tight">
        <Button type="button" variant="danger" size="sm" disabled={pending} onClick={cancel}>
          Yes, cancel
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </Inline>
      {failed ? (
        <div role="alert">
          <Text tone="danger" variant="note">
            This subscription could not be cancelled. Please contact us.
          </Text>
        </div>
      ) : null}
    </Stack>
  );
}
