import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/core/app.js";
import { prisma } from "../src/config/prisma.js";
import {
  canReachDatabase,
  getListingBySlug,
  loginAs,
  seedCredentials
} from "./test-helpers.js";

test("billing APIs cover summary, checkout, confirmation, history, and admin visibility", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const sellerAgent = await loginAs(app, seedCredentials.seller);

  const summaryResponse = await sellerAgent.get("/api/billing/summary");
  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.body.success, true);
  assert.equal(typeof summaryResponse.body.data.currentPlan.slug, "string");

  const plansResponse = await sellerAgent.get("/api/billing/plans");
  assert.equal(plansResponse.status, 200);

  const currentPlanSlug = String(summaryResponse.body.data.currentPlan.slug);
  const targetPlan = plansResponse.body.data.find(
    (plan: { slug: string; isFree: boolean }) => !plan.isFree && plan.slug !== currentPlanSlug
  );

  assert.ok(targetPlan, "expected a paid plan different from the current plan");

  const checkoutResponse = await sellerAgent.post("/api/billing/checkout/subscription").send({
    planSlug: targetPlan.slug
  });

  assert.equal(checkoutResponse.status, 201);
  assert.equal(checkoutResponse.body.success, true);
  assert.equal(typeof checkoutResponse.body.data.sessionId, "string");
  assert.equal(typeof checkoutResponse.body.data.url, "string");
  assert.match(checkoutResponse.body.data.mode, /^(demo|live)$/);

  const sessionId = String(checkoutResponse.body.data.sessionId);

  if (checkoutResponse.body.data.mode === "demo") {
    const confirmResponse = await sellerAgent.post("/api/billing/checkout/confirm").send({
      sessionId
    });

    assert.equal(confirmResponse.status, 200);
    assert.equal(confirmResponse.body.success, true);
    assert.equal(confirmResponse.body.data.payment.status, "SUCCEEDED");
    assert.equal(confirmResponse.body.data.payment.plan.slug, targetPlan.slug);
    assert.equal(confirmResponse.body.data.summary.currentPlan.slug, targetPlan.slug);
  }

  const historyResponse = await sellerAgent.get("/api/billing/history");
  assert.equal(historyResponse.status, 200);
  assert.equal(historyResponse.body.success, true);

  const matchingPayment = historyResponse.body.data.payments.find(
    (payment: { stripeCheckoutSessionId: string; status: string }) =>
      payment.stripeCheckoutSessionId === sessionId
  );

  assert.ok(matchingPayment, "expected the new checkout to appear in billing history");
  assert.match(matchingPayment.status, /^(PENDING|SUCCEEDED)$/);

  const nonFeaturedListing = await getListingBySlug("gaming-youtube-monetized");
  await prisma.listing.update({
    where: {
      id: nonFeaturedListing.id
    },
    data: {
      isFeatured: false
    }
  });

  const featuredCheckoutResponse = await sellerAgent
    .post("/api/billing/checkout/featured")
    .send({
      listingId: nonFeaturedListing.id
    });

  assert.equal(featuredCheckoutResponse.status, 201);
  assert.equal(featuredCheckoutResponse.body.success, true);
  assert.equal(typeof featuredCheckoutResponse.body.data.sessionId, "string");
  assert.match(featuredCheckoutResponse.body.data.mode, /^(demo|live)$/);

  const featuredSessionId = String(featuredCheckoutResponse.body.data.sessionId);

  if (featuredCheckoutResponse.body.data.mode === "demo") {
    const confirmFeaturedResponse = await sellerAgent.post("/api/billing/checkout/confirm").send({
      sessionId: featuredSessionId
    });

    assert.equal(confirmFeaturedResponse.status, 200);
    assert.equal(confirmFeaturedResponse.body.success, true);
    assert.equal(confirmFeaturedResponse.body.data.payment.status, "SUCCEEDED");
    assert.equal(confirmFeaturedResponse.body.data.listing.id, nonFeaturedListing.id);

    const refreshedListing = await prisma.listing.findUniqueOrThrow({
      where: {
        id: nonFeaturedListing.id
      },
      select: {
        isFeatured: true
      }
    });

    assert.equal(refreshedListing.isFeatured, true);
  }

  const forbiddenAdminPaymentsResponse = await sellerAgent.get("/api/billing/admin/payments");
  assert.equal(forbiddenAdminPaymentsResponse.status, 403);

  const adminAgent = await loginAs(app, seedCredentials.admin);
  const adminPaymentsResponse = await adminAgent.get("/api/billing/admin/payments?limit=10");

  assert.equal(adminPaymentsResponse.status, 200);
  assert.equal(adminPaymentsResponse.body.success, true);
  assert.ok(Array.isArray(adminPaymentsResponse.body.data.items));
  assert.ok(adminPaymentsResponse.body.data.items.length >= 1);
  assert.equal(typeof adminPaymentsResponse.body.data.meta.totalRevenue, "number");
});
