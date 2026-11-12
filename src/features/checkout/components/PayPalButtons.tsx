'use client';
// Renders PayPal's own buttons (PayPal, Pay Later, card) into a div. Card data stays in
// PayPal's hosted fields (PCI stays PayPal's, G11). Callbacks read the latest props via ref.
import { useEffect, useRef } from 'react';
import { Text } from '@/components/ui/mds';
import type { Currency } from '@/lib/commerce/money';
import { loadPayPal, type PayPalMode } from '../paypalSdk';

type Props = {
  clientId: string;
  currency: Currency;
  /** order = one-time capture; subscription = recurring offer (G5). */
  mode: PayPalMode;
  /** Resolves the server-created PayPal order or subscription id. */
  create: () => Promise<string>;
  /** Resolves 'restart' when the buyer should pick another funding source. */
  onApprove: (providerId: string) => Promise<'done' | 'restart'>;
  onError: (error: unknown) => void;
};

export function PayPalButtons(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const { clientId, currency, mode } = props;

  useEffect(() => {
    let closed = false;
    let buttons: { close(): Promise<void> } | null = null;
    loadPayPal(clientId, currency, mode)
      .then((paypal) => {
        if (closed || !container.current) return;
        const create = () => latest.current.create();
        const instance = paypal.Buttons({
          ...(mode === 'order' ? { createOrder: create } : { createSubscription: create }),
          // onApprove must return its promise so the SDK waits for the capture.
          onApprove: async (data, actions) => {
            const id = mode === 'order' ? data.orderID : data.subscriptionID;
            if (!id) throw new Error(`PayPal approved without a ${mode} id`);
            if ((await latest.current.onApprove(id)) === 'restart') await actions.restart();
          },
          onError: (error) => latest.current.onError(error),
        });
        buttons = instance;
        return instance.render(container.current);
      })
      .catch((error: unknown) => latest.current.onError(error));
    return () => {
      closed = true;
      buttons?.close().catch((error: unknown) => latest.current.onError(error));
    };
  }, [clientId, currency, mode]);

  return (
    <div ref={container}>
      <noscript>
        <Text tone="muted">PayPal needs JavaScript.</Text>
      </noscript>
    </div>
  );
}
