// Branded checkout page for one offer (G11, G28). Price shown from the server; the order is
// created server-side from the offer row, never from anything the browser sends.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody, Heading, Stack, Text } from '@/components/ui/mds';
import { applyCouponAction, completeCheckoutAction, startCheckoutAction } from '@/features/checkout/actions';
import { loadCheckout } from '@/features/checkout/api/load';
import { CheckoutForm } from '@/features/checkout/components/CheckoutForm';
import { formatMoney } from '@/lib/commerce/money';
import styles from './page.module.css';

type Props = PageProps<'/[space]/checkout/[offer]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { space, offer } = await params;
  const found = await loadCheckout(space, offer);
  return { title: found ? `Checkout: ${found.offer.title}` : 'Checkout', robots: { index: false } };
}

export default async function CheckoutPage({ params }: Props) {
  const { space, offer: slug } = await params;
  const found = await loadCheckout(space, slug);
  if (!found) notFound();
  const { offer, locale, payable, clientId, couponField } = found;
  return (
    <div className={styles.layout}>
      <Stack gap="base">
        <Heading level={1} variant="title">
          {offer.title}
        </Heading>
        {offer.description ? <Text>{offer.description}</Text> : null}
        <Card>
          <CardBody>
            <Stack gap="tight">
              <Text variant="label">{offer.priceCents === 0 ? 'Free' : formatMoney(offer.priceCents, offer.currency, locale)}</Text>
              {offer.products.length > 0 ? (
                <ul className={styles.products}>
                  {offer.products.map((title) => (
                    <li key={title}>
                      <Text tone="secondary">{title}</Text>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      </Stack>
      {payable ? (
        <CheckoutForm
          offer={{ slug: offer.slug, title: offer.title, priceCents: offer.priceCents, currency: offer.currency, bump: offer.bump }}
          clientId={clientId}
          locale={locale}
          couponField={couponField}
          applyCouponAction={applyCouponAction}
          startAction={startCheckoutAction}
          completeAction={completeCheckoutAction}
        />
      ) : (
        <Text role="alert" tone="danger">
          Payments are not set up for this site yet.
        </Text>
      )}
    </div>
  );
}
