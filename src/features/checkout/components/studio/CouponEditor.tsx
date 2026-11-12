// Studio > Coupons > one coupon: code, discount, limits, expiry, offers, on/off, delete (G23).
// Kajabi: https://help.kajabi.com/articles/sales/coupons/how-to-create-a-coupon
import { Checkbox, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import type { StudioCouponDetail } from '../../api/coupons';
import { CodeAndDiscount, CouponState } from './CouponFields';
import { CouponForm } from './StudioForms';
import styles from './Studio.module.css';

const dateInput = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');

export function CouponEditor({ detail, now }: { detail: StudioCouponDetail; now: Date }) {
  const { coupon, uses, offers } = detail;
  const id = { couponId: coupon.id };
  const linked = new Set(coupon.offerIds);
  return (
    <Stack gap="loose">
      <div className={styles.actions}>
        <CouponState coupon={coupon} now={now} />
        <Text variant="note">{coupon.maxUses === null ? `Used ${uses} times` : `Used ${uses} of ${coupon.maxUses} times`}</Text>
      </div>

      <CouponForm fields={{ op: 'update', ...id }} submit="Save">
        <CodeAndDiscount coupon={coupon} />
        <div className={styles.row}>
          <Field label="Max uses" hint="Empty = no limit.">
            <Input name="maxUses" inputMode="numeric" defaultValue={coupon.maxUses === null ? '' : String(coupon.maxUses)} />
          </Field>
          <Field label="Expires on" hint="Stops working at the start of this day (UTC). Empty = never.">
            <Input name="expiresAt" type="date" defaultValue={dateInput(coupon.expiresAt)} />
          </Field>
        </div>
        <Checkbox name="oncePerCustomer" label="Once per customer (by email)" defaultChecked={coupon.oncePerCustomer} />
        <Checkbox name="active" label="Active" defaultChecked={coupon.active} />
        <fieldset className={styles.products}>
          <legend>Works on these offers</legend>
          {offers.length === 0 ? <Text variant="note">No offers yet.</Text> : null}
          {offers.map((o) => (
            <Checkbox key={o.id} name="offerId" value={o.id} defaultChecked={linked.has(o.id)} label={`${o.title} (${o.currency})`} />
          ))}
        </fieldset>
      </CouponForm>

      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Delete
        </Heading>
        <Text variant="note">A used coupon cannot be deleted. Turn it off instead.</Text>
        <div className={styles.actions}>
          <CouponForm fields={{ op: 'delete', ...id }} submit="Delete coupon" variant="danger" confirm={`Delete “${coupon.code}”?`} />
        </div>
      </Stack>
    </Stack>
  );
}
