// Studio > Coupons > one coupon (G23).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/links';
import { Heading, Stack } from '@/components/ui/mds';
import { studioCoupon } from '@/features/checkout/api/coupons';
import { CouponEditor } from '@/features/checkout/components/studio/CouponEditor';
import { studioCouponsHref } from '@/features/checkout/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Coupon' };

export default async function StudioCouponPage({ params }: PageProps<'/[space]/studio/coupons/[id]'>) {
  const { space, id } = await params;
  const viewer = await currentViewer(space);
  const detail = viewer ? await studioCoupon(getRepo(), viewer, id) : null;
  if (!viewer || !detail) notFound();
  return (
    <Stack gap="loose">
      <BackLink href={studioCouponsHref}>coupons</BackLink>
      <Heading level={1} variant="title">
        {detail.coupon.code}
      </Heading>
      <CouponEditor detail={detail} now={new Date()} locale={viewer.space.locale} />
    </Stack>
  );
}
