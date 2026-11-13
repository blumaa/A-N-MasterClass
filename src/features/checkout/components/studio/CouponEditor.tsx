// Studio > Coupons > one coupon: code, discount, limits, expiry, offers, on/off, report,
// checkout links with the coupon applied, delete (G23).
// Kajabi: https://help.kajabi.com/articles/sales/coupons/how-to-create-a-coupon
import { AppLink } from '@/components/ui/links';
import { Checkbox, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import type { StudioCouponDetail } from '../../api/coupons';
import { checkoutPath } from '../../paths';
import { CodeAndDiscount, CouponState } from './CouponFields';
import { CouponReport } from './CouponReport';
import { CouponForm } from './StudioForms';
import styles from './Studio.module.css';

const dateInput = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');

export function CouponEditor({ detail, now, locale }: { detail: StudioCouponDetail; now: Date; locale: string }) {
  const { coupon, report, offers } = detail;
  const { uses } = report;
  const id = { couponId: coupon.id };
  const linked = new Set(coupon.offerIds);
  const linkedOffers = offers.filter((o) => linked.has(o.id));
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
          Checkout links
        </Heading>
        <Text variant="note">These links open the checkout with the coupon already applied. Buyers can still remove it.</Text>
        {linkedOffers.length === 0 ? <Text variant="note">Tick an offer above to get its link.</Text> : null}
        {linkedOffers.map((o) => {
          const href = checkoutPath(o.slug, coupon.code);
          return (
            <Text key={o.id} variant="note">
              {o.title}: <AppLink href={href}>{href}</AppLink>
            </Text>
          );
        })}
      </Stack>

      <CouponReport report={report} locale={locale} />

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
