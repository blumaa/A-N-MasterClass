// Coupon Supabase repo against the linked project (G23). Service client: RLS is covered by
// supabase/tests/210-coupons-bumps-upsells.test.sql; this checks queries, mapping and constraint mapping.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUPON_CODE_TAKEN,
  COUPON_DISCOUNT,
  COUPON_HAS_ORDERS,
  COUPON_OFFER_SPACE,
  ConstraintError,
} from "@/lib/data/errors";
import type { NewCoupon } from "@/lib/data/repo";
import { createCommerceRepo, type CommerceRepo } from "./commerce";
import { createCouponRepo, type CouponRepo } from "./coupon";
import {
  contractEnabled,
  createContractSpace,
  type ContractSpace,
} from "./testing/contractSpace";

const T0 = new Date("2026-01-01T00:00:00Z");

describe.skipIf(!contractEnabled)("coupon repo (Supabase contract)", () => {
  let fx: ContractSpace;
  let other: ContractSpace;
  let repo: CouponRepo;
  let commerce: CommerceRepo;
  let spaceId: string;

  const newCoupon = (over: Partial<NewCoupon> = {}): NewCoupon => ({
    spaceId,
    code: "TEN",
    percentOff: 10,
    amountOffCents: null,
    currency: null,
    maxUses: null,
    oncePerCustomer: false,
    expiresAt: null,
    active: true,
    offerIds: [],
    ...over,
  });

  const offer = (slug: string, space = spaceId) =>
    commerce.createOffer({
      spaceId: space,
      slug,
      title: slug,
      priceCents: 4900,
      currency: "EUR",
    });

  beforeAll(async () => {
    fx = await createContractSpace("coupon");
    other = await createContractSpace("coupon-other");
    spaceId = fx.spaceId;
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    repo = createCouponRepo(ctx);
    commerce = createCommerceRepo(ctx);
  });
  afterAll(async () => {
    await fx?.cleanup();
    await other?.cleanup();
  });

  it("creates with uppercase code and offers, lists by code, finds by id and code", async () => {
    const o = await offer("c-main");
    const b = await repo.createCoupon(
      newCoupon({ code: "zeta", offerIds: [o.id, o.id] }),
    );
    const a = await repo.createCoupon(
      newCoupon({
        code: "ALPHA",
        percentOff: null,
        amountOffCents: 500,
        currency: "EUR",
        maxUses: 3,
        expiresAt: T0,
      }),
    );
    expect(b).toMatchObject({
      code: "ZETA",
      percentOff: 10,
      offerIds: [o.id],
      active: true,
    });
    expect(a).toMatchObject({
      amountOffCents: 500,
      currency: "EUR",
      maxUses: 3,
      expiresAt: T0,
      offerIds: [],
    });
    expect((await repo.coupons(spaceId)).map((c) => c.code)).toEqual([
      "ALPHA",
      "ZETA",
    ]);
    expect(await repo.coupon(b.id)).toEqual(b);
    expect(await repo.couponByCode(spaceId, "zeta")).toEqual(b);
    expect(await repo.couponByCode(other.spaceId, "ZETA")).toBeNull();
  });

  it("refuses a taken code, a bad discount and an offer of another space", async () => {
    await repo.createCoupon(newCoupon({ code: "TAKEN" }));
    await expect(
      repo.createCoupon(newCoupon({ code: "taken" })),
    ).rejects.toThrow(COUPON_CODE_TAKEN);
    await expect(
      repo.createCoupon(newCoupon({ code: "BAD", percentOff: 101 })),
    ).rejects.toThrow(COUPON_DISCOUNT);
    const foreign = await offer("c-foreign", other.spaceId);
    await expect(
      repo.createCoupon(newCoupon({ code: "FOREIGN", offerIds: [foreign.id] })),
    ).rejects.toThrow(COUPON_OFFER_SPACE);
    expect(await repo.couponByCode(spaceId, "FOREIGN")).toBeNull();
  });

  it("updates named fields and replaces offers; a bad offer keeps the old links", async () => {
    const [o1, o2] = await Promise.all([offer("c-u1"), offer("c-u2")]);
    const c = await repo.createCoupon(
      newCoupon({ code: "UPD", offerIds: [o1.id] }),
    );
    const u = await repo.updateCoupon(c.id, {
      active: false,
      offerIds: [o2.id],
    });
    expect(u).toMatchObject({
      code: "UPD",
      percentOff: 10,
      active: false,
      offerIds: [o2.id],
    });
    const foreign = await offer("c-u-foreign", other.spaceId);
    await expect(
      repo.updateCoupon(c.id, { offerIds: [foreign.id] }),
    ).rejects.toBeInstanceOf(ConstraintError);
    expect((await repo.coupon(c.id))?.offerIds).toEqual([o2.id]);
  });

  it("shows the field only for an active, unexpired coupon on the offer", async () => {
    const o = await offer("c-active");
    expect(await repo.hasActiveCoupon(o.id, T0)).toBe(false);
    const c = await repo.createCoupon(
      newCoupon({
        code: "ACT",
        offerIds: [o.id],
        expiresAt: new Date("2026-02-01T00:00:00Z"),
      }),
    );
    expect(await repo.hasActiveCoupon(o.id, T0)).toBe(true);
    expect(
      await repo.hasActiveCoupon(o.id, new Date("2026-02-01T00:00:00Z")),
    ).toBe(false);
    await repo.updateCoupon(c.id, { active: false });
    expect(await repo.hasActiveCoupon(o.id, T0)).toBe(false);
  });

  it("counts uses from orders past created; a used coupon cannot be deleted", async () => {
    const o = await offer("c-uses");
    const c = await repo.createCoupon(
      newCoupon({ code: "USES", offerIds: [o.id] }),
    );
    const order = (email: string, n: number) =>
      commerce.createOrder({
        spaceId,
        offerId: o.id,
        email,
        provider: "fake",
        providerOrderId: `c-po-${n}`,
        amountCents: 4410,
        currency: "EUR",
        livemode: false,
        waiverVersion: "v1",
        waiverAcceptedAt: T0,
        marketingConsent: false,
        createdAt: new Date(),
        couponId: c.id,
        discountCents: 490,
      });
    const paid = await order("A@Example.com", 1);
    await order("b@example.com", 2);
    expect(await repo.couponUses(c.id, "a@example.com")).toEqual({
      total: 0,
      byEmail: 0,
    });
    const buyer = await fx.newUser("buyer");
    await commerce.updateOrder(paid.id, {
      status: "paid",
      profileId: buyer,
      paidAt: new Date(),
    });
    expect(await repo.couponUses(c.id, "A@EXAMPLE.COM")).toEqual({
      total: 1,
      byEmail: 1,
    });
    await expect(repo.deleteCoupon(c.id)).rejects.toThrow(COUPON_HAS_ORDERS);

    const unused = await repo.createCoupon(
      newCoupon({ code: "GONE", offerIds: [o.id] }),
    );
    await repo.deleteCoupon(unused.id);
    expect(await repo.coupon(unused.id)).toBeNull();
  });
});
