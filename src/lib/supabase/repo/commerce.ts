// Supabase Repo: offers, orders, payment credentials, contacts, claim links.
// Semantics mirror src/lib/data/fake/fakeCommerceRepo.ts; constraints come from the SQL schema.
// Order, contact and claim-token writes have no RLS write policy (server-only, money depends on
// them), so those run on admin(). Secrets and token hashes too.
import { ConstraintError } from "@/lib/data/errors";
import type { Repo } from "@/lib/data/repo";
import {
  check,
  defined,
  isoOrNull,
  unwrap,
  unwrapMaybe,
  type RepoCtx,
} from "./context";
import {
  toClaimToken,
  toContact,
  toOffer,
  toOfferItem,
  toOrder,
  toPaymentCredentials,
} from "./mapCommerce";

export type CommerceRepo = Pick<
  Repo,
  | "offers"
  | "offer"
  | "offerBySlug"
  | "createOffer"
  | "updateOffer"
  | "deleteOffer"
  | "offerItems"
  | "setOfferItems"
  | "orders"
  | "order"
  | "orderByProviderId"
  | "orderByCaptureId"
  | "createOrder"
  | "updateOrder"
  | "paymentCredentials"
  | "paymentSecret"
  | "savePaymentCredentials"
  | "contacts"
  | "upsertContact"
  | "createClaimToken"
  | "consumeClaimToken"
>;

export function createCommerceRepo({ db, admin }: RepoCtx): CommerceRepo {
  return {
    // offers
    async offers(spaceId) {
      const rows = unwrap(
        await (
          await db()
        )
          .from("offers")
          .select("*")
          .eq("space_id", spaceId)
          .order("title"),
      );
      return rows.map(toOffer);
    },
    async offer(id) {
      const row = unwrapMaybe(
        await (
          await db()
        )
          .from("offers")
          .select("*")
          .eq("id", id)
          .maybeSingle(),
      );
      return row && toOffer(row);
    },
    async offerBySlug(spaceId, slug) {
      const row = unwrapMaybe(
        await (
          await db()
        )
          .from("offers")
          .select("*")
          .eq("space_id", spaceId)
          .eq("slug", slug)
          .maybeSingle(),
      );
      return row && toOffer(row);
    },
    async createOffer(input) {
      const row = unwrap(
        await (
          await db()
        )
          .from("offers")
          .insert({
            space_id: input.spaceId,
            slug: input.slug,
            title: input.title,
            price_cents: input.priceCents,
            currency: input.currency,
          })
          .select("*")
          .single(),
      );
      return toOffer(row);
    },
    async updateOffer(id, patch) {
      const row = unwrap(
        await (
          await db()
        )
          .from("offers")
          .update(
            defined({
              slug: patch.slug,
              title: patch.title,
              description: patch.description,
              price_cents: patch.priceCents,
              currency: patch.currency,
              status: patch.status,
              updated_at: new Date().toISOString(),
            }),
          )
          .eq("id", id)
          .select("*")
          .single(),
      );
      return toOffer(row);
    },
    // Orders reference offers with on delete restrict: an offer that sold cannot go.
    async deleteOffer(id) {
      check(await (await db()).from("offers").delete().eq("id", id));
    },
    async offerItems(offerId) {
      const rows = unwrap(
        await (
          await db()
        )
          .from("offer_products")
          .select("*")
          .eq("offer_id", offerId),
      );
      return rows.map(toOfferItem);
    },
    // No transaction here: the whole set is validated first, so a bad item leaves the old set intact.
    // The SQL trigger only checks the product's space; the access-group rule lives here.
    async setOfferItems(offerId, items) {
      const c = await db();
      const offer = unwrap(
        await c.from("offers").select("space_id").eq("id", offerId).single(),
      );
      const byProduct = new Map(
        items.map((i) => [i.productId, i.accessGroupId]),
      );
      const productIds = [...byProduct.keys()];
      if (productIds.length > 0) {
        const products = unwrap(
          await c.from("products").select("id, space_id").in("id", productIds),
        );
        const inSpace = new Set(
          products
            .filter((p) => p.space_id === offer.space_id)
            .map((p) => p.id),
        );
        if (productIds.some((id) => !inSpace.has(id)))
          throw new ConstraintError("product not in offer space");
        const groupIds = [...byProduct.values()].filter(
          (g): g is string => g !== null,
        );
        if (groupIds.length > 0) {
          const groups = unwrap(
            await c
              .from("access_groups")
              .select("id, community_id")
              .in("id", groupIds),
          );
          const community = new Map(groups.map((g) => [g.id, g.community_id]));
          for (const [productId, groupId] of byProduct) {
            if (groupId !== null && community.get(groupId) !== productId) {
              throw new ConstraintError(
                "access group must belong to its community",
              );
            }
          }
        }
      }
      check(await c.from("offer_products").delete().eq("offer_id", offerId));
      if (productIds.length === 0) return;
      check(
        await c
          .from("offer_products")
          .insert(
            [...byProduct].map(([product_id, access_group_id]) => ({
              offer_id: offerId,
              product_id,
              access_group_id,
            })),
          ),
      );
    },

    // orders (newest first)
    async orders(spaceId) {
      const rows = unwrap(
        await (
          await db()
        )
          .from("orders")
          .select("*")
          .eq("space_id", spaceId)
          .order("created_at", { ascending: false }),
      );
      return rows.map(toOrder);
    },
    async order(id) {
      const row = unwrapMaybe(
        await (
          await db()
        )
          .from("orders")
          .select("*")
          .eq("id", id)
          .maybeSingle(),
      );
      return row && toOrder(row);
    },
    async orderByProviderId(provider, providerOrderId) {
      const row = unwrapMaybe(
        await (
          await db()
        )
          .from("orders")
          .select("*")
          .eq("provider", provider)
          .eq("provider_order_id", providerOrderId)
          .maybeSingle(),
      );
      return row && toOrder(row);
    },
    async orderByCaptureId(provider, captureId) {
      const row = unwrapMaybe(
        await (
          await db()
        )
          .from("orders")
          .select("*")
          .eq("provider", provider)
          .eq("capture_id", captureId)
          .maybeSingle(),
      );
      return row && toOrder(row);
    },
    // No write policy on orders: server-only.
    async createOrder(input) {
      const row = unwrap(
        await admin()
          .from("orders")
          .insert({
            space_id: input.spaceId,
            offer_id: input.offerId,
            email: input.email.toLowerCase(),
            provider: input.provider,
            provider_order_id: input.providerOrderId,
            amount_cents: input.amountCents,
            currency: input.currency,
            livemode: input.livemode,
            waiver_version: input.waiverVersion,
            waiver_accepted_at: input.waiverAcceptedAt.toISOString(),
            marketing_consent: input.marketingConsent,
            created_at: input.createdAt.toISOString(),
          })
          .select("*")
          .single(),
      );
      return toOrder(row);
    },
    // Plain column update. Revoking grants on a refund is the set_order_status RPC's job, not this.
    async updateOrder(id, patch) {
      const columns = defined({
        profile_id: patch.profileId,
        capture_id: patch.captureId,
        status: patch.status,
        paid_at: isoOrNull(patch.paidAt),
      });
      // An empty update returns no rows in PostgREST: read the row instead.
      const query =
        Object.keys(columns).length === 0
          ? admin().from("orders").select("*")
          : admin().from("orders").update(columns).select("*");
      return toOrder(unwrap(await query.eq("id", id).single()));
    },

    // payment credentials: row via RLS (payments.manage); the secret only through admin RPCs
    async paymentCredentials(spaceId, env) {
      const row = unwrapMaybe(
        await (
          await db()
        )
          .from("payment_credentials")
          .select("*")
          .eq("space_id", spaceId)
          .eq("provider", "paypal")
          .eq("env", env)
          .maybeSingle(),
      );
      return row && toPaymentCredentials(row);
    },
    // Decrypts from Vault: whoever calls, this stays on the secret key.
    async paymentSecret(spaceId, env) {
      const { data, error } = await admin().rpc("payment_secret", {
        target_space: spaceId,
        target_env: env,
      });
      if (error) throw new Error(`[${error.code}] ${error.message}`);
      return data ?? null;
    },
    async savePaymentCredentials(row, secret) {
      check(
        await (await db()).from("payment_credentials").upsert(
          {
            space_id: row.spaceId,
            provider: "paypal",
            env: row.env,
            client_id: row.clientId,
            webhook_id: row.webhookId,
            updated_at: row.updatedAt.toISOString(),
          },
          { onConflict: "space_id,provider,env" },
        ),
      );
      if (secret === null) return;
      // Vault write: secret key only. Needs the row above to exist.
      check(
        await admin().rpc("save_payment_secret", {
          target_space: row.spaceId,
          target_env: row.env,
          secret,
        }),
      );
    },

    // contacts (by email)
    async contacts(spaceId) {
      const rows = unwrap(
        await (
          await db()
        )
          .from("contacts")
          .select("*")
          .eq("space_id", spaceId)
          .order("email"),
      );
      return rows.map(toContact);
    },
    // No write policy on contacts: server-only. Consent is never withdrawn; first opt-in wins.
    async upsertContact({ spaceId, email, profileId, consent }) {
      const c = admin();
      const key = email.toLowerCase();
      check(
        await c
          .from("contacts")
          .upsert(
            { space_id: spaceId, email: key },
            { onConflict: "space_id,email", ignoreDuplicates: true },
          ),
      );
      const current = unwrap(
        await c
          .from("contacts")
          .select("*")
          .eq("space_id", spaceId)
          .eq("email", key)
          .single(),
      );
      const patch = defined({
        profile_id: profileId ?? undefined,
        ...(consent && !current.marketing_consent
          ? {
              marketing_consent: true,
              consent_at: consent.at.toISOString(),
              consent_source: consent.source,
            }
          : {}),
      });
      if (Object.keys(patch).length === 0) return toContact(current);
      const row = unwrap(
        await c
          .from("contacts")
          .update(patch)
          .eq("space_id", spaceId)
          .eq("email", key)
          .select("*")
          .single(),
      );
      return toContact(row);
    },

    // claim links: no RLS policy at all, secret key only
    async createClaimToken(row) {
      check(
        await admin()
          .from("claim_tokens")
          .insert({
            token_hash: row.tokenHash,
            space_id: row.spaceId,
            profile_id: row.profileId,
            expires_at: row.expiresAt.toISOString(),
            used_at: isoOrNull(row.usedAt),
          }),
      );
    },
    // consume_claim_token is one atomic UPDATE ... RETURNING. It judges expiry by the DB clock (now()),
    // so the `now` argument is not used here.
    async consumeClaimToken(spaceId, tokenHash) {
      const { data, error } = await admin().rpc("consume_claim_token", {
        target_space: spaceId,
        hash: tokenHash,
      });
      if (error) throw new Error(`[${error.code}] ${error.message}`);
      const row = data[0];
      return row ? toClaimToken(row) : null;
    },
  };
}
