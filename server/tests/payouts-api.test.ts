import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/core/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import {
  canReachDatabase,
  ensureIdentityVerificationStatus,
  loginAs,
  seedCredentials
} from "./test-helpers.js";

test("payout APIs gate onboarding by identity verification and expose seller payout readiness", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  if (env.STRIPE_SECRET_KEY) {
    t.skip("Payout onboarding API test expects Stripe to be disabled locally");
    return;
  }

  const app = createApp();
  const sellerAgent = await loginAs(app, seedCredentials.seller);
  const seller = await prisma.user.findUniqueOrThrow({
    where: {
      email: seedCredentials.seller.email
    },
    select: {
      id: true
    }
  });

  await prisma.user.update({
    where: {
      id: seller.id
    },
    data: {
      stripeConnectedAccountId: null,
      stripeConnectedAccountStatus: "NOT_CONNECTED",
      stripeConnectedAccountStatusReason: null,
      stripeConnectedAccountOnboardedAt: null,
      stripeConnectedAccountLastSyncedAt: null
    }
  });

  await ensureIdentityVerificationStatus(seedCredentials.seller.email, "NOT_STARTED");

  const blockedResponse = await sellerAgent.post("/api/payouts/onboarding-link").send({});
  assert.equal(blockedResponse.status, 400);
  assert.match(String(blockedResponse.body.message), /identity verification/i);

  await ensureIdentityVerificationStatus(seedCredentials.seller.email, "APPROVED");

  const summaryResponse = await sellerAgent.get("/api/payouts/me");
  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.body.success, true);
  assert.equal(summaryResponse.body.data.status, "NOT_CONNECTED");
  assert.equal(summaryResponse.body.data.protectedDealEligible, true);
  assert.equal(summaryResponse.body.data.payoutsReady, false);

  const onboardingResponse = await sellerAgent.post("/api/payouts/onboarding-link").send({});
  assert.equal(onboardingResponse.status, 201);
  assert.equal(onboardingResponse.body.success, true);
  assert.equal(onboardingResponse.body.data.mode, "demo");
  assert.match(String(onboardingResponse.body.data.url), /settings\?connect=demo/);
});
