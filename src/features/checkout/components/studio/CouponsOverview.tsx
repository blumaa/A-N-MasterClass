// Studio > Coupons: list + create (G23). Limits, expiry and offers are set on each coupon's page.
import { LinkRow } from '@/components/ui/links';
import { EmptyState, Heading, ListGroup, Stack } from '@/components/ui/mds';
import type { StudioCouponRow } from '../../api/coupons';
import { studioCouponHref } from '../../paths';
import { CodeAndDiscount, CouponState, discountLabel } from './CouponFields';
import { CouponForm } from './StudioForms';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function CouponsOverview({ coupons, locale, now }: { coupons: StudioCouponRow[]; locale: string; now: Date }) {
  return (
    <Stack gap="loose">
      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" description="A coupon code takes a percent or an amount off an offer." />
      ) : (
        <ListGroup>
          {coupons.map(({ coupon, uses }) => (
            <LinkRow
              key={coupon.id}
              href={studioCouponHref(coupon.id)}
              title={coupon.code}
              description={[
                discountLabel(coupon, locale),
                plural(coupon.offerIds.length, 'offer'),
                coupon.maxUses === null ? plural(uses, 'use') : `${uses} of ${coupon.maxUses} uses`,
              ].join(' · ')}
              trailing={<CouponState coupon={coupon} now={now} />}
            />
          ))}
        </ListGroup>
      )}
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          New coupon
        </Heading>
        <CouponForm fields={{ op: 'create' }} submit="Create coupon" variant="primary">
          <CodeAndDiscount />
        </CouponForm>
      </Stack>
    </Stack>
  );
}
