'use client';
// Renders PayPal's own buttons (PayPal, Pay Later, card) into a div. Card data stays in
// PayPal's hosted fields (PCI stays PayPal's, G11). Callbacks read the latest props via ref.
import { useEffect, useRef } from 'react';
import { Text } from '@/components/ui/mds';
import type { Currency } from '@/lib/commerce/money';
import { loadPayPal } from '../paypalSdk';

type Props = {
  clientId: string;
  currency: Currency;
  createOrder: () => Promise<string>;
  /** Resolves 'restart' when the buyer should pick another funding source. */
  onApprove: (providerOrderId: string) => Promise<'done' | 'restart'>;
  onError: (error: unknown) => void;
};

export function PayPalButtons(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const { clientId, currency } = props;

  useEffect(() => {
    let closed = false;
    let buttons: { close(): Promise<void> } | null = null;
    loadPayPal(clientId, currency)
      .then((paypal) => {
        if (closed || !container.current) return;
        const instance = paypal.Buttons({
          createOrder: () => latest.current.createOrder(),
          // onApprove must return its promise so the SDK waits for the capture.
          onApprove: async (data, actions) => {
            if ((await latest.current.onApprove(data.orderID)) === 'restart') await actions.restart();
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
  }, [clientId, currency]);

  return (
    <div ref={container}>
      <noscript>
        <Text tone="muted">PayPal needs JavaScript.</Text>
      </noscript>
    </div>
  );
}
