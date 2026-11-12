// PayPal JS SDK loader. No npm wrapper: the script tag is PayPal's documented integration and
// keeps us off the wrapper's breaking majors. One script per (client id, currency, mode).
// Subscriptions need vault=true&intent=subscription; the plan carries the currency:
// https://developer.paypal.com/docs/subscriptions/integrate/
import type { Currency } from '@/lib/commerce/money';

export type PayPalButtonsInstance = { render(el: HTMLElement): Promise<void>; close(): Promise<void> };

export type PayPalMode = 'order' | 'subscription';

type Approve = { orderID?: string; subscriptionID?: string };

export type PayPalNamespace = {
  Buttons(
    options: ({ createOrder: () => Promise<string> } | { createSubscription: () => Promise<string> }) & {
      onApprove: (data: Approve, actions: { restart(): Promise<void> }) => Promise<void>;
      onError: (error: unknown) => void;
    },
  ): PayPalButtonsInstance;
};

export const paypalSdkUrl = (clientId: string, currency: Currency, mode: PayPalMode = 'order'): string => {
  const params: Record<string, string> =
    mode === 'order'
      ? { 'client-id': clientId, currency, intent: 'capture' }
      : { 'client-id': clientId, vault: 'true', intent: 'subscription' };
  return `https://www.paypal.com/sdk/js?${new URLSearchParams(params)}`;
};

const loads = new Map<string, Promise<PayPalNamespace>>();

export function loadPayPal(clientId: string, currency: Currency, mode: PayPalMode): Promise<PayPalNamespace> {
  const src = paypalSdkUrl(clientId, currency, mode);
  let load = loads.get(src);
  if (!load) {
    load = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        const paypal = (window as Window & { paypal?: PayPalNamespace }).paypal;
        if (paypal) resolve(paypal);
        else reject(new Error('PayPal SDK loaded without window.paypal'));
      };
      script.onerror = () => {
        loads.delete(src);
        reject(new Error('PayPal SDK failed to load'));
      };
      document.head.append(script);
    });
    loads.set(src, load);
  }
  return load;
}
