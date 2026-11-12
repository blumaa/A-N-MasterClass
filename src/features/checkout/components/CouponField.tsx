'use client';
// Coupon code box (G23). "Apply" asks the server for the discount; the server checks the code
// again when the order is created, so this preview is display only.
import { useState, useTransition } from 'react';
import { Button, Field, Inline, Input, Text } from '@/components/ui/mds';
import type { CouponPreview } from '../api/checkout';

export type AppliedCoupon = { code: string; discountCents: number };

type Props = {
  offerSlug: string;
  applied: AppliedCoupon | null;
  onChange: (coupon: AppliedCoupon | null) => void;
  applyAction: (offerSlug: string, code: string) => Promise<CouponPreview>;
};

export function CouponField({ offerSlug, applied, onChange, applyAction }: Props) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    startTransition(async () => {
      setMessage(null);
      const result = await applyAction(offerSlug, code);
      if (result.ok) onChange({ code: result.code, discountCents: result.discountCents });
      else setMessage(result.message);
    });
  }

  if (applied) {
    return (
      <Inline gap="tight">
        <Text variant="note">{applied.code} applied</Text>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Remove
        </Button>
      </Inline>
    );
  }
  return (
    <Field label="Coupon code">
      <Inline gap="tight">
        <Input name="coupon" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="button" variant="secondary" disabled={!code.trim()} loading={pending} onClick={apply}>
          Apply
        </Button>
      </Inline>
      {message ? (
        <div role="alert">
          <Text tone="danger" variant="note">
            {message}
          </Text>
        </div>
      ) : null}
    </Field>
  );
}
