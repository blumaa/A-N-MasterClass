// PayPal JS SDK loader. No npm wrapper: the script tag is PayPal's documented integration and
// keeps us off the wrapper's breaking majors. One script per (client id, currency).
import type { Currency } from '@/lib/commerce/money';

export type PayPalButtonsInstance = { render(el: HTMLElement): Promise<void>; close(): Promise<void> };

export type PayPalNamespace = {
  Buttons(options: {
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }, actions: { restart(): Promise<void> }) => Promise<void>;
    onError: (error: unknown) => void;
  }): PayPalButtonsInstance;
};

export const paypalSdkUrl = (clientId: string, currency: Currency): string =>
  `https://www.paypal.com/sdk/js?${new URLSearchParams({ 'client-id': clientId, currency, intent: 'capture' })}`;

const loads = new Map<string, Promise<PayPalNamespace>>();

export function loadPayPal(clientId: string, currency: Currency): Promise<PayPalNamespace> {
  const src = paypalSdkUrl(clientId, currency);
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
