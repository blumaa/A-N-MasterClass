// Studio > Offers: list + create (G13). Checkout link lives on each offer's page.
import { LinkRow } from '@/components/ui/links';
import { EmptyState, Field, Heading, Input, ListGroup, Stack } from '@/components/ui/mds';
import { formatMoney } from '@/lib/commerce/money';
import type { StudioOfferRow } from '../../api/offers';
import { studioOfferHref } from '../../paths';
import { OfferStatus } from './OfferStatus';
import { PriceFields } from './OfferFields';
import { OfferForm } from './StudioForms';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function OffersOverview({ offers, locale }: { offers: StudioOfferRow[]; locale: string }) {
  return (
    <Stack gap="loose">
      {offers.length === 0 ? (
        <EmptyState title="No offers yet" description="An offer sells one or more products for one price." />
      ) : (
        <ListGroup>
          {offers.map(({ offer, productCount, sold }) => (
            <LinkRow
              key={offer.id}
              href={studioOfferHref(offer.id)}
              title={offer.title}
              description={[formatMoney(offer.priceCents, offer.currency, locale), plural(productCount, 'product'), `${sold} sold`].join(' · ')}
              trailing={<OfferStatus status={offer.status} />}
            />
          ))}
        </ListGroup>
      )}
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          New offer
        </Heading>
        <OfferForm fields={{ op: 'create' }} submit="Create offer">
          <Field label="Title">
            <Input name="title" required />
          </Field>
          <PriceFields />
        </OfferForm>
      </Stack>
    </Stack>
  );
}
