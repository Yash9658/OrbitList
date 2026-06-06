import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/core/app.js";
import { prisma } from "../src/config/prisma.js";
import {
  canReachDatabase,
  getUserIdByEmail,
  loginAs,
  seedCredentials
} from "./test-helpers.js";

test("identity and insights APIs cover submission, admin review, and payout readiness insights", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const sellerAgent = request.agent(app);
  const uniqueSuffix = Date.now().toString();
  const sellerEmail = `seller-${uniqueSuffix}@orbitlist.dev`;

  const signupResponse = await sellerAgent.post("/api/auth/signup").send({
    email: sellerEmail,
    password: "Orbitlist123!",
    fullName: "Orbit Seller LLP",
    username: `seller_${uniqueSuffix}`,
    country: "India",
    role: "SELLER"
  });

  assert.equal(signupResponse.status, 201);
  assert.equal(signupResponse.body.success, true);

  const sellerId = await getUserIdByEmail(sellerEmail);

  await prisma.identityVerification.deleteMany({
    where: {
      userId: sellerId
    }
  });

  const initialResponse = await sellerAgent.get("/api/identity/me");
  assert.equal(initialResponse.status, 200);
  assert.equal(initialResponse.body.data.status, "NOT_STARTED");

  const submitResponse = await sellerAgent.post("/api/identity/me").send({
    legalName: "Orbit Seller LLP",
    dateOfBirth: "1996-08-15",
    country: "India",
    documentType: "Passport",
    documentNumberLast4: "4567",
    addressLine1: "42 Orbit Street",
    city: "Pune",
    postalCode: "411001",
    documentUrl: "https://example.com/kyc-document.pdf",
    notes: "Ready for protected transfer workflows."
  });

  assert.equal(submitResponse.status, 200);
  assert.equal(submitResponse.body.success, true);
  assert.equal(submitResponse.body.data.status, "PENDING");

  const verificationId = String(submitResponse.body.data.id);

  const adminQueueResponse = await adminAgent.get("/api/identity/admin");
  assert.equal(adminQueueResponse.status, 200);
  assert.ok(
    adminQueueResponse.body.data.data.some(
      (item: { id: string }) => item.id === verificationId
    )
  );

  const reviewResponse = await adminAgent.patch(`/api/identity/admin/${verificationId}`).send({
    status: "APPROVED"
  });

  assert.equal(reviewResponse.status, 200);
  assert.equal(reviewResponse.body.success, true);
  assert.equal(reviewResponse.body.data.status, "APPROVED");

  const sellerInsightsResponse = await sellerAgent.get("/api/insights/me");
  assert.equal(sellerInsightsResponse.status, 200);
  assert.equal(sellerInsightsResponse.body.success, true);
  assert.equal(sellerInsightsResponse.body.data.identityStatus, "APPROVED");
  assert.equal(sellerInsightsResponse.body.data.protectedTransferReady, true);

  const publicInsightsResponse = await sellerAgent.get(`/api/insights/seller/${sellerId}`);
  assert.equal(publicInsightsResponse.status, 200);
  assert.equal(publicInsightsResponse.body.success, true);
  assert.equal(publicInsightsResponse.body.data.sellerId, sellerId);
  assert.equal(typeof publicInsightsResponse.body.data.reputationScore, "number");
});
