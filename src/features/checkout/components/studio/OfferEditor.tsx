// Studio > Offers > one offer: settings, linked products, bump/upsell, publish, checkout link, delete.
import { PRODUCT_KIND_LABELS } from '@/lib/labels';
import { PublishStatusBadge } from '@/components/PublishStatusBadge/PublishStatusBadge';
import { AppLink } from '@/components/ui/links';
import { Checkbox, Field, Heading, Input, Select, Stack, Text, Textarea } from '@/components/ui/mds';
import type { StudioOfferDetail } from '../../api/offers';
import { checkoutPath } from '../../paths';
import { PriceFields, PriceTypeFields } from './OfferFields';
import { OfferLinks } from './OfferLinks';
import { OfferForm } from './StudioForms';
import styles from './Studio.module.css';

export function OfferEditor({ detail }: { detail: StudioOfferDetail }) {
  const { offer, items, products } = detail;
  const id = { offerId: offer.id };
  const linked = new Map(items.map((i) => [i.productId, i.accessGroupId]));
  const published = offer.status === 'published';
  return (
    <Stack gap="loose">
      <div className={styles.actions}>
        <PublishStatusBadge status={offer.status} />
        {published ? (
          <Text variant="note">
            Checkout link: <AppLink href={checkoutPath(offer.slug)}>{checkoutPath(offer.slug)}</AppLink>
          </Text>
        ) : null}
      </div>

      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Settings
        </Heading>
        <OfferForm fields={{ op: 'update', ...id }} submit="Save">
          <Field label="Title">
            <Input name="title" required defaultValue={offer.title} />
          </Field>
          <Field label="Address" hint="Checkout page: /checkout/<address>">
            <Input name="slug" required defaultValue={offer.slug} />
          </Field>
          <PriceFields priceCents={offer.priceCents} currency={offer.currency} />
          <PriceTypeFields {...offer} />
          <Field label="Description" hint="Shown on the checkout page.">
            <Textarea name="description" rows={3} defaultValue={offer.description ?? ''} />
          </Field>
        </OfferForm>
      </Stack>

      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Products
        </Heading>
        <OfferForm fields={{ op: 'setProducts', ...id }} submit="Save products">
          <fieldset className={styles.products}>
            <legend>Buyers get access to</legend>
            {products.map((p) => (
              <div key={p.id} className={styles.product}>
                <Checkbox name="productId" value={p.id} defaultChecked={linked.has(p.id)} label={`${p.title} (${PRODUCT_KIND_LABELS[p.kind]})`} />
                {p.groups.length > 0 ? (
                  <Field label={`Access group in ${p.title}`}>
                    <Select name={`group:${p.id}`} defaultValue={linked.get(p.id) ?? ''}>
                      <option value="">Members (default)</option>
                      {p.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </div>
            ))}
          </fieldset>
        </OfferForm>
      </Stack>

      <OfferLinks detail={detail} />

      <div className={styles.actions}>
        {published ? (
          <OfferForm fields={{ op: 'unpublish', ...id }} submit="Unpublish" />
        ) : (
          <OfferForm fields={{ op: 'publish', ...id }} submit="Publish" variant="primary" />
        )}
        <OfferForm fields={{ op: 'delete', ...id }} submit="Delete offer" variant="danger" confirm={`Delete “${offer.title}”?`} />
      </div>
    </Stack>
  );
}
