// Payment credential env SSOT (G10). Only module that reads PAYMENTS_ENV.
// sandbox = PayPal sandbox apps, orders livemode=false (dev, staging). live = production only.
import { PAYMENT_ENVS, type PaymentEnv } from '@/lib/data/types';

type Env = Record<string, string | undefined>;

export function readPaymentsEnv(env: Env): PaymentEnv {
  const value = env.PAYMENTS_ENV ?? 'sandbox';
  if (!PAYMENT_ENVS.includes(value as PaymentEnv)) {
    throw new Error(`PAYMENTS_ENV must be one of ${PAYMENT_ENVS.join(', ')}; got ${JSON.stringify(value)}`);
  }
  return value as PaymentEnv;
}

export const paymentsEnv = (): PaymentEnv => readPaymentsEnv(process.env);
