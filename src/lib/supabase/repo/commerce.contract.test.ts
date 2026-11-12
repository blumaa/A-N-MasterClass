// Commerce Supabase repo against the linked project. Runs as the service client: RLS is covered by
// the SQL suites; this checks queries, mapping, ordering and constraint mapping.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ConstraintError,
  OFFER_LINK_SELF,
  OFFER_LINK_SPACE,
  ORDER_EXTRAS,
} from "@/lib/data/errors";
import type { ClaimToken, Order } from "@/lib/data/types";
import { createCommerceRepo, type CommerceRepo } from "./commerce";
import { createCoreRepo, type CoreRepo } from "./core";
import {
  contractEnabled,
  createContractSpace,
  type ContractSpace,
} from "./testing/contractSpace";

const hash = (n: number) => n.toString(16).padStart(64, "0");
const T0 = new Date("2026-01-01T00:00:00Z");

describe.skipIf(!contractEnabled)("commerce repo (Supabase contract)", () => {
  let fx: ContractSpace;
  let repo: CommerceRepo;
  let core: CoreRepo;
  let spaceId: string;
  let seq = 0;
  const next = () => `${++seq}`;

  const newOrder = (offerId: string, over: Partial<Order> = {}) => ({
    spaceId,
    offerId,
    email: "Buyer@Example.com",
    provider: "fake" as const,
    providerOrderId: `po-${next()}`,
    amountCents: 1000,
    currency: "EUR" as const,
    livemode: false,
    waiverVersion: "v1",
    waiverAcceptedAt: T0,
    marketingConsent: false,
    createdAt: new Date(),
    ...over,
  });

  beforeAll(async () => {
    fx = await createContractSpace("commerce");
    spaceId = fx.spaceId;
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    repo = createCommerceRepo(ctx);
    core = createCoreRepo(ctx);
  });
  afterAll(async () => {
    await fx?.cleanup();
  });

  describe("offers", () => {
    it("creates drafts, orders by title, finds by id and slug", async () => {
      const b = await repo.createOffer({
        spaceId,
        slug: "o-b",
        title: "Beta",
        priceCents: 0,
        currency: "EUR",
      });
      const a = await repo.createOffer({
        spaceId,
        slug: "o-a",
        title: "Alpha",
        priceCents: 4900,
        currency: "USD",
      });
      expect(a).toMatchObject({
        status: "draft",
        description: null,
        priceCents: 4900,
        currency: "USD",
      });
      expect(
        (await repo.offers(spaceId)).map((o) => o.title).slice(0, 2),
      ).toEqual(["Alpha", "Beta"]);
      expect(await repo.offer(a.id)).toEqual(a);
      expect(await repo.offerBySlug(spaceId, "o-b")).toEqual(b);
      expect(
        await repo.offer("00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
      expect(await repo.offerBySlug(spaceId, "nope")).toBeNull();
    });

    it("refuses bad slug, duplicate slug and out-of-range price", async () => {
      await repo.createOffer({
        spaceId,
        slug: "dup",
        title: "Dup",
        priceCents: 1,
        currency: "EUR",
      });
      const bad = [
        { slug: "dup", priceCents: 1 },
        { slug: "Bad Slug", priceCents: 1 },
        { slug: "neg", priceCents: -1 },
        { slug: "big", priceCents: 10_000_000 },
      ];
      for (const b of bad) {
        await expect(
          repo.createOffer({ spaceId, title: "X", currency: "EUR", ...b }),
        ).rejects.toBeInstanceOf(ConstraintError);
      }
    });

    it("updates only named fields; refuses a taken slug", async () => {
      const o = await repo.createOffer({
        spaceId,
        slug: "upd",
        title: "Upd",
        priceCents: 100,
        currency: "EUR",
      });
      const u = await repo.updateOffer(o.id, {
        status: "published",
        description: "Desc",
      });
      expect(u).toMatchObject({
        status: "published",
        description: "Desc",
        title: "Upd",
        priceCents: 100,
      });
      expect(
        (await repo.updateOffer(o.id, { description: null })).description,
      ).toBeNull();
      await expect(
        repo.updateOffer(o.id, { slug: "dup" }),
      ).rejects.toBeInstanceOf(ConstraintError);
      await expect(
        repo.updateOffer("00000000-0000-0000-0000-000000000000", {
          title: "x",
        }),
      ).rejects.toThrow();
    });

    it("links a bump and upsell in the space; refuses self; clears on delete", async () => {
      const mk = (slug: string, space = spaceId) =>
        repo.createOffer({
          spaceId: space,
          slug,
          title: slug,
          priceCents: 100,
          currency: "EUR",
        });
      const [main, bump, up] = await Promise.all([
        mk("lk-main"),
        mk("lk-bump"),
        mk("lk-up"),
      ]);
      expect(main).toMatchObject({ bumpOfferId: null, upsellOfferId: null });
      const linked = await repo.updateOffer(main.id, {
        bumpOfferId: bump.id,
        upsellOfferId: up.id,
      });
      expect(linked).toMatchObject({
        bumpOfferId: bump.id,
        upsellOfferId: up.id,
      });
      await expect(
        repo.updateOffer(main.id, { bumpOfferId: main.id }),
      ).rejects.toThrow(OFFER_LINK_SELF);
      const foreign = await createContractSpace("commerce-links");
      try {
        const far = await mk("lk-far", foreign.spaceId);
        await expect(
          repo.updateOffer(main.id, { upsellOfferId: far.id }),
        ).rejects.toThrow(OFFER_LINK_SPACE);
      } finally {
        await foreign.cleanup();
      }
      await repo.deleteOffer(up.id);
      expect(await repo.offer(main.id)).toMatchObject({
        bumpOfferId: bump.id,
        upsellOfferId: null,
      });
    });

    it("sets items as a replacing set; rejects foreign products and wrong groups", async () => {
      const o = await repo.createOffer({
        spaceId,
        slug: "items",
        title: "Items",
        priceCents: 1,
        currency: "EUR",
      });
      const p1 = await core.createProduct({
        spaceId,
        kind: "program",
        slug: "it-p1",
        title: "P1",
      });
      const p2 = await core.createProduct({
        spaceId,
        kind: "program",
        slug: "it-p2",
        title: "P2",
      });
      const comm = await core.createProduct({
        spaceId,
        kind: "community",
        slug: "it-c",
        title: "C",
      });
      const group = (
        await fx.admin
          .from("access_groups")
          .select("id")
          .eq("community_id", comm.id)
          .eq("is_default", true)
          .single()
      ).data;
      expect(group).not.toBeNull();

      await repo.setOfferItems(o.id, [
        { productId: p1.id, accessGroupId: null },
        { productId: comm.id, accessGroupId: group!.id },
      ]);
      expect(
        (await repo.offerItems(o.id)).toSorted((a, b) =>
          a.productId.localeCompare(b.productId),
        ),
      ).toEqual(
        [
          { productId: p1.id, accessGroupId: null },
          { productId: comm.id, accessGroupId: group!.id },
        ].toSorted((a, b) => a.productId.localeCompare(b.productId)),
      );

      // replace, duplicates collapse to one row per product (last wins)
      await repo.setOfferItems(o.id, [
        { productId: p2.id, accessGroupId: null },
        { productId: p2.id, accessGroupId: null },
      ]);
      expect(await repo.offerItems(o.id)).toEqual([
        { productId: p2.id, accessGroupId: null },
      ]);

      // group on a non-community product, and a product from nowhere: refused, old set kept
      await expect(
        repo.setOfferItems(o.id, [
          { productId: p1.id, accessGroupId: group!.id },
        ]),
      ).rejects.toBeInstanceOf(ConstraintError);
      await expect(
        repo.setOfferItems(o.id, [
          {
            productId: "00000000-0000-0000-0000-000000000000",
            accessGroupId: null,
          },
        ]),
      ).rejects.toBeInstanceOf(ConstraintError);
      expect(await repo.offerItems(o.id)).toEqual([
        { productId: p2.id, accessGroupId: null },
      ]);

      await repo.setOfferItems(o.id, []);
      expect(await repo.offerItems(o.id)).toEqual([]);
    });

    it("rejects a product from another space", async () => {
      const other = await fx.admin
        .from("spaces")
        .insert({ slug: `${fx.slug}-x`, name: "Other", is_test: true })
        .select("id")
        .single();
      expect(other.error).toBeNull();
      const foreign = await core.createProduct({
        spaceId: other.data!.id,
        kind: "program",
        slug: "f",
        title: "F",
      });
      const o = await repo.createOffer({
        spaceId,
        slug: "foreign",
        title: "Foreign",
        priceCents: 1,
        currency: "EUR",
      });
      await expect(
        repo.setOfferItems(o.id, [
          { productId: foreign.id, accessGroupId: null },
        ]),
      ).rejects.toBeInstanceOf(ConstraintError);
      await fx.admin.from("spaces").delete().eq("id", other.data!.id);
    });

    it("deletes an offer with its items, but not once it has orders", async () => {
      const p = await core.createProduct({
        spaceId,
        kind: "program",
        slug: "del-p",
        title: "DP",
      });
      const free = await repo.createOffer({
        spaceId,
        slug: "del-free",
        title: "DF",
        priceCents: 1,
        currency: "EUR",
      });
      await repo.setOfferItems(free.id, [
        { productId: p.id, accessGroupId: null },
      ]);
      await repo.deleteOffer(free.id);
      expect(await repo.offer(free.id)).toBeNull();
      expect(await repo.offerItems(free.id)).toEqual([]);

      const sold = await repo.createOffer({
        spaceId,
        slug: "del-sold",
        title: "DS",
        priceCents: 1,
        currency: "EUR",
      });
      await repo.createOrder(newOrder(sold.id));
      await expect(repo.deleteOffer(sold.id)).rejects.toBeInstanceOf(
        ConstraintError,
      );
      expect(await repo.offer(sold.id)).not.toBeNull();
    });
  });

  describe("orders", () => {
    it("stores coupon and bump extras; refuses a discount without a coupon", async () => {
      const mk = (slug: string) =>
        repo.createOffer({
          spaceId,
          slug,
          title: slug,
          priceCents: 4900,
          currency: "EUR",
        });
      const [main, bump] = await Promise.all([mk("ex-main"), mk("ex-bump")]);
      const plain = await repo.createOrder(newOrder(main.id));
      expect(plain).toMatchObject({
        couponId: null,
        discountCents: 0,
        bumpOfferId: null,
        bumpCents: 0,
      });
      const withBump = await repo.createOrder(
        newOrder(main.id, {
          amountCents: 5800,
          bumpOfferId: bump.id,
          bumpCents: 900,
        }),
      );
      expect(withBump).toMatchObject({
        amountCents: 5800,
        bumpOfferId: bump.id,
        bumpCents: 900,
      });
      await expect(
        repo.createOrder(newOrder(main.id, { discountCents: 100 })),
      ).rejects.toThrow(ORDER_EXTRAS);
      await expect(repo.deleteOffer(bump.id)).rejects.toBeInstanceOf(
        ConstraintError,
      );
    });
    it("creates created-orders with lowercased email, newest first, finds by provider id and capture", async () => {
      const o = await repo.createOffer({
        spaceId,
        slug: "ord",
        title: "Ord",
        priceCents: 1000,
        currency: "EUR",
      });
      const first = await repo.createOrder(
        newOrder(o.id, { createdAt: new Date("2026-02-01T00:00:00Z") }),
      );
      const second = await repo.createOrder(
        newOrder(o.id, { createdAt: new Date("2026-03-01T00:00:00Z") }),
      );
      expect(first).toMatchObject({
        email: "buyer@example.com",
        status: "created",
        profileId: null,
        captureId: null,
        paidAt: null,
        waiverAcceptedAt: T0,
      });
      const ids = (await repo.orders(spaceId)).map((x) => x.id);
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
      expect(await repo.order(first.id)).toEqual(first);
      expect(
        await repo.orderByProviderId("fake", first.providerOrderId),
      ).toEqual(first);
      expect(
        await repo.orderByProviderId("paypal", first.providerOrderId),
      ).toBeNull();
      expect(
        await repo.order("00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
    });

    it("refuses a duplicate provider order id and an unknown offer; same id under another provider is fine", async () => {
      const o = await repo.createOffer({
        spaceId,
        slug: "ord2",
        title: "Ord2",
        priceCents: 1000,
        currency: "EUR",
      });
      const a = await repo.createOrder(newOrder(o.id));
      await expect(
        repo.createOrder(
          newOrder(o.id, { providerOrderId: a.providerOrderId }),
        ),
      ).rejects.toBeInstanceOf(ConstraintError);
      await expect(
        repo.createOrder(
          newOrder(o.id, {
            providerOrderId: a.providerOrderId,
            provider: "paypal",
          }),
        ),
      ).resolves.toBeDefined();
      // fake throws a plain Error here; SQL FK is a ConstraintError
      await expect(
        repo.createOrder(newOrder("00000000-0000-0000-0000-000000000000")),
      ).rejects.toBeInstanceOf(ConstraintError);
    });

    it("updates orders; capture id is unique per provider; paid needs buyer and paidAt", async () => {
      const o = await repo.createOffer({
        spaceId,
        slug: "ord3",
        title: "Ord3",
        priceCents: 1000,
        currency: "EUR",
      });
      const buyer = await fx.newUser("buyer");
      const a = await repo.createOrder(newOrder(o.id));
      const b = await repo.createOrder(newOrder(o.id));
      const paidAt = new Date("2026-04-01T00:00:00Z");
      const paid = await repo.updateOrder(a.id, {
        status: "paid",
        captureId: "cap-1",
        profileId: buyer,
        paidAt,
      });
      expect(paid).toMatchObject({
        status: "paid",
        captureId: "cap-1",
        profileId: buyer,
        paidAt,
      });
      expect(await repo.orderByCaptureId("fake", "cap-1")).toEqual(paid);
      expect(await repo.orderByCaptureId("fake", "nope")).toBeNull();
      await expect(
        repo.updateOrder(b.id, { captureId: "cap-1" }),
      ).rejects.toBeInstanceOf(ConstraintError);
      await expect(
        repo.updateOrder(b.id, { status: "paid" }),
      ).rejects.toBeInstanceOf(ConstraintError);
      expect(await repo.updateOrder(a.id, {})).toEqual(paid);
    });
  });

  describe("payment credentials", () => {
    const creds = (env: "sandbox" | "live", over = {}) => ({
      spaceId,
      env,
      clientId: "client-1",
      webhookId: null,
      updatedAt: new Date("2026-05-01T00:00:00Z"),
      ...over,
    });

    it("is null until saved; upserts per env; never returns the secret", async () => {
      expect(await repo.paymentCredentials(spaceId, "sandbox")).toBeNull();
      expect(await repo.paymentSecret(spaceId, "sandbox")).toBeNull();
      await repo.savePaymentCredentials(creds("sandbox"), "s3cret");
      await repo.savePaymentCredentials(
        creds("live", { clientId: "live-client" }),
        null,
      );
      expect(await repo.paymentCredentials(spaceId, "sandbox")).toEqual(
        creds("sandbox"),
      );
      expect(
        Object.values((await repo.paymentCredentials(spaceId, "sandbox"))!),
      ).not.toContain("s3cret");
      expect(await repo.paymentSecret(spaceId, "sandbox")).toBe("s3cret");
      expect(await repo.paymentSecret(spaceId, "live")).toBeNull();
    });

    it("keeps the stored secret on null, replaces it otherwise, updates the row", async () => {
      const row = creds("sandbox", { clientId: "client-2", webhookId: "wh-1" });
      await repo.savePaymentCredentials(row, null);
      expect(await repo.paymentCredentials(spaceId, "sandbox")).toEqual(row);
      expect(await repo.paymentSecret(spaceId, "sandbox")).toBe("s3cret");
      await repo.savePaymentCredentials(row, "rotated");
      expect(await repo.paymentSecret(spaceId, "sandbox")).toBe("rotated");
      await expect(
        repo.savePaymentCredentials(creds("live", { clientId: " " }), null),
      ).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  describe("contacts", () => {
    it("upserts by lowercase email; first consent wins; profile only ever set; ordered by email", async () => {
      const profileId = await fx.newUser("contact");
      const c1 = await repo.upsertContact({
        spaceId,
        email: "Zed@Example.com",
        profileId: null,
        consent: null,
      });
      expect(c1).toMatchObject({
        email: "zed@example.com",
        profileId: null,
        marketingConsent: false,
        consentAt: null,
        consentSource: null,
      });

      const at = new Date("2026-06-01T00:00:00Z");
      const c2 = await repo.upsertContact({
        spaceId,
        email: "zed@example.com",
        profileId,
        consent: { source: "checkout", at },
      });
      expect(c2).toMatchObject({
        profileId,
        marketingConsent: true,
        consentAt: at,
        consentSource: "checkout",
        createdAt: c1.createdAt,
      });

      const c3 = await repo.upsertContact({
        spaceId,
        email: "zed@example.com",
        profileId: null,
        consent: { source: "later", at: new Date("2027-01-01T00:00:00Z") },
      });
      expect(c3).toEqual(c2);
      expect(
        await repo.upsertContact({
          spaceId,
          email: "zed@example.com",
          profileId: null,
          consent: null,
        }),
      ).toEqual(c2);

      await repo.upsertContact({
        spaceId,
        email: "abe@example.com",
        profileId: null,
        consent: null,
      });
      expect((await repo.contacts(spaceId)).map((c) => c.email)).toEqual([
        "abe@example.com",
        "zed@example.com",
      ]);
    });
  });

  describe("claim tokens", () => {
    const token = async (
      n: number,
      over: Partial<ClaimToken> = {},
    ): Promise<ClaimToken> => ({
      tokenHash: hash(n + Date.now()),
      spaceId,
      profileId: await fx.newUser(`claim${n}`),
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
      ...over,
    });

    it("consumes a valid token once, marks it used, then returns null", async () => {
      const t = await token(1);
      await repo.createClaimToken(t);
      const got = await repo.consumeClaimToken(
        spaceId,
        t.tokenHash,
        new Date(),
      );
      expect(got).toMatchObject({
        tokenHash: t.tokenHash,
        spaceId,
        profileId: t.profileId,
      });
      expect(got!.usedAt).toBeInstanceOf(Date);
      expect(
        await repo.consumeClaimToken(spaceId, t.tokenHash, new Date()),
      ).toBeNull();
    });

    it("refuses a duplicate hash, an expired token, a wrong space and an unknown hash", async () => {
      const t = await token(2);
      await repo.createClaimToken(t);
      await expect(repo.createClaimToken(t)).rejects.toBeInstanceOf(
        ConstraintError,
      );
      await expect(
        repo.createClaimToken({ ...t, tokenHash: "not-hex" }),
      ).rejects.toBeInstanceOf(ConstraintError);

      const expired = await token(3, {
        expiresAt: new Date(Date.now() - 1000),
      });
      await repo.createClaimToken(expired);
      expect(
        await repo.consumeClaimToken(spaceId, expired.tokenHash, new Date()),
      ).toBeNull();

      expect(
        await repo.consumeClaimToken(
          "00000000-0000-0000-0000-000000000000",
          t.tokenHash,
          new Date(),
        ),
      ).toBeNull();
      expect(
        await repo.consumeClaimToken(spaceId, hash(999), new Date()),
      ).toBeNull();
      // still valid for the right space
      expect(
        await repo.consumeClaimToken(spaceId, t.tokenHash, new Date()),
      ).not.toBeNull();
    });
  });
});
