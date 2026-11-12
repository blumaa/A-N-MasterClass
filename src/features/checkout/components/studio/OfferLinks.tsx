// Studio offer: order bump and upsell picks (G23). A bump shares the PayPal order, so only
// one-time offers of the same currency are listed, and recurring offers take no bump (G5).
// Only published offers show to buyers.
import { Field, Heading, Select, Stack } from '@/components/ui/mds';
import type { StudioOfferDetail } from '../../api/offers';
import { OfferForm } from './StudioForms';

type Other = StudioOfferDetail['others'][number];

const bumpable = (currency: string) => (o: Other) => o.currency === currency && o.kind === 'one_time';

const label = (o: Other) => (o.status === 'published' ? o.title : `${o.title} (draft)`);

function OfferSelect({ name, value, offers }: { name: string; value: string | null; offers: Other[] }) {
  return (
    <Select name={name} defaultValue={value ?? ''}>
      <option value="">None</option>
      {offers.map((o) => (
        <option key={o.id} value={o.id}>
          {label(o)}
        </option>
      ))}
    </Select>
  );
}

export function OfferLinks({ detail }: { detail: StudioOfferDetail }) {
  const { offer, others } = detail;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Order bump and upsell
      </Heading>
      <OfferForm fields={{ op: 'setLinks', offerId: offer.id }} submit="Save bump and upsell">
        {offer.kind === 'one_time' ? (
          <Field label="Order bump" hint="Buyers can tick it at checkout. Paid in the same payment.">
            <OfferSelect name="bumpOfferId" value={offer.bumpOfferId} offers={others.filter(bumpable(offer.currency))} />
          </Field>
        ) : null}
        <Field label="Upsell" hint="Offered on the thank-you page after a purchase.">
          <OfferSelect name="upsellOfferId" value={offer.upsellOfferId} offers={others} />
        </Field>
      </OfferForm>
    </Stack>
  );
}
