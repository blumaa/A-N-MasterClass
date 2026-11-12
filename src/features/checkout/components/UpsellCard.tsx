// Upsell offer on the thank-you page (G23). "Yes" starts a second checkout for the upsell.
import { Card, CardBody, Heading, Inline, Stack, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { formatMoney } from '@/lib/commerce/money';
import type { UpsellOffer } from '../api/upsell';
import { checkoutPath } from '../paths';

type Props = { upsell: UpsellOffer; locale: string; declineHref: string };

export function UpsellCard({ upsell, locale, declineHref }: Props) {
  return (
    <Card>
      <CardBody>
        <Stack gap="tight">
          <Text variant="note" tone="secondary">
            One more thing
          </Text>
          <Heading level={2} variant="subtitle">
            {upsell.title}
          </Heading>
          {upsell.description ? <Text>{upsell.description}</Text> : null}
          <Text variant="label">{formatMoney(upsell.priceCents, upsell.currency, locale)}</Text>
          <Inline gap="tight">
            <ButtonLink href={checkoutPath(upsell.slug)}>{`Yes, add ${upsell.title}`}</ButtonLink>
            <ButtonLink href={declineHref} variant="ghost">
              No thanks
            </ButtonLink>
          </Inline>
        </Stack>
      </CardBody>
    </Card>
  );
}
