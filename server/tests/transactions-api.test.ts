import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/core/app.js";
import { prisma } from "../src/config/prisma.js";
import {
  canReachDatabase,
  ensureIdentityVerificationStatus,
  getUserIdByEmail,
  getListingBySlug,
  loginAs,
  seedCredentials
} from "./test-helpers.js";

test("transaction APIs cover protected checkout, handoff, disputes, and admin resolution", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const buyerAgent = await loginAs(app, seedCredentials.buyer);
  const sellerAgent = await loginAs(app, seedCredentials.seller);
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const listing = await getListingBySlug("gaming-youtube-monetized");

  await ensureIdentityVerificationStatus(seedCredentials.buyer.email, "APPROVED");
  await ensureIdentityVerificationStatus(seedCredentials.seller.email, "APPROVED");

  await prisma.dispute.deleteMany({
    where: {
      transaction: {
        listingId: listing.id,
        buyer: {
          email: seedCredentials.buyer.email
        }
      }
    }
  });

  await prisma.transaction.deleteMany({
    where: {
      listingId: listing.id,
      buyer: {
        email: seedCredentials.buyer.email
      }
    }
  });

  const createCheckoutResponse = await buyerAgent.post("/api/transactions/checkout").send({
    listingId: listing.id,
    buyerNotes: `Need a protected transfer ${Date.now()}`
  });

  assert.equal(createCheckoutResponse.status, 201);
  assert.equal(createCheckoutResponse.body.success, true);
  assert.equal(createCheckoutResponse.body.data.transaction.status, "PENDING_PAYMENT");

  const sessionId = String(createCheckoutResponse.body.data.sessionId);
  const transactionId = String(createCheckoutResponse.body.data.transaction.id);

  const confirmResponse = await buyerAgent.post("/api/transactions/checkout/confirm").send({
    sessionId
  });

  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmResponse.body.success, true);
  assert.equal(confirmResponse.body.data.transaction.status, "FUNDS_SECURED");

  const sellerHandoffResponse = await sellerAgent.patch(`/api/transactions/${transactionId}/status`).send({
    status: "HANDOFF_SUBMITTED",
    notes: "Credentials and brand files prepared."
  });

  assert.equal(sellerHandoffResponse.status, 200);
  assert.equal(sellerHandoffResponse.body.success, true);
  assert.equal(sellerHandoffResponse.body.data.status, "HANDOFF_SUBMITTED");

  const disputeResponse = await buyerAgent.post(`/api/transactions/${transactionId}/disputes`).send({
    reason: "Transfer access issue",
    details: "Recovery email and backup codes were missing from the package."
  });

  assert.equal(disputeResponse.status, 201);
  assert.equal(disputeResponse.body.success, true);
  assert.equal(disputeResponse.body.data.status, "DISPUTED");
  assert.equal(disputeResponse.body.data.disputes.length >= 1, true);

  const disputeId = String(disputeResponse.body.data.disputes[0].id);

  const evidenceResponse = await buyerAgent
    .post(`/api/transactions/disputes/${disputeId}/evidence`)
    .send({
      fileUrl: "https://example.com/dispute-evidence-1.pdf",
      note: "Missing recovery assets screenshot."
    });

  assert.equal(evidenceResponse.status, 201);
  assert.equal(evidenceResponse.body.success, true);
  assert.equal(evidenceResponse.body.data.evidence.length, 1);
  assert.equal(evidenceResponse.body.data.caseEvents.length >= 2, true);

  const adminDisputesResponse = await adminAgent.get("/api/transactions/admin/disputes");
  assert.equal(adminDisputesResponse.status, 200);
  assert.ok(
    adminDisputesResponse.body.data.data.some(
      (dispute: { id: string }) => dispute.id === disputeId
    )
  );
  assert.ok(
    adminDisputesResponse.body.data.data.some(
      (dispute: { id: string; evidence: Array<{ fileUrl: string }> }) =>
        dispute.id === disputeId &&
        dispute.evidence.some((evidence) => evidence.fileUrl.includes("dispute-evidence-1"))
    )
  );

  const resolutionResponse = await adminAgent
    .patch(`/api/transactions/admin/disputes/${disputeId}`)
    .send({
      status: "RESOLVED_FOR_SELLER",
      resolutionNotes: "Seller supplied the missing recovery assets and the transfer can complete."
    });

  assert.equal(resolutionResponse.status, 200);
  assert.equal(resolutionResponse.body.success, true);
  assert.equal(resolutionResponse.body.data.transaction.status, "COMPLETED");
  assert.equal(
    resolutionResponse.body.data.transaction.sellerPayoutStatus,
    "PENDING_RELEASE"
  );

  const releaseResponse = await adminAgent.post(`/api/transactions/admin/${transactionId}/release`).send({
    notes: "Manual payout release recorded by ops."
  });

  assert.equal(releaseResponse.status, 200);
  assert.equal(releaseResponse.body.success, true);
  assert.equal(releaseResponse.body.data.sellerPayoutStatus, "RELEASED");

  const buyerTransactionsResponse = await buyerAgent.get("/api/transactions");
  assert.equal(buyerTransactionsResponse.status, 200);
  assert.ok(
    buyerTransactionsResponse.body.data.data.some(
      (transaction: { id: string; status: string }) =>
        transaction.id === transactionId &&
        transaction.status === "COMPLETED" &&
        transaction.sellerPayoutStatus === "RELEASED"
    )
  );
});

test("transaction APIs cover admin-issued buyer refund after dispute resolution", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const buyerAgent = await loginAs(app, seedCredentials.buyer);
  const sellerAgent = await loginAs(app, seedCredentials.seller);
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const listing = await getListingBySlug("gaming-youtube-monetized");

  await ensureIdentityVerificationStatus(seedCredentials.buyer.email, "APPROVED");
  await ensureIdentityVerificationStatus(seedCredentials.seller.email, "APPROVED");

  await prisma.dispute.deleteMany({
    where: {
      transaction: {
        listingId: listing.id,
        buyer: {
          email: seedCredentials.buyer.email
        }
      }
    }
  });

  await prisma.transaction.deleteMany({
    where: {
      listingId: listing.id,
      buyer: {
        email: seedCredentials.buyer.email
      }
    }
  });

  const checkoutResponse = await buyerAgent.post("/api/transactions/checkout").send({
    listingId: listing.id,
    buyerNotes: `Refund path ${Date.now()}`
  });

  const transactionId = String(checkoutResponse.body.data.transaction.id);
  const sessionId = String(checkoutResponse.body.data.sessionId);

  await buyerAgent.post("/api/transactions/checkout/confirm").send({ sessionId });
  await sellerAgent.patch(`/api/transactions/${transactionId}/status`).send({
    status: "HANDOFF_SUBMITTED",
    notes: "Package submitted."
  });
  await buyerAgent.post(`/api/transactions/${transactionId}/disputes`).send({
    reason: "Ownership mismatch",
    details: "The transferred credentials did not match the agreed account."
  });

  const adminDisputesResponse = await adminAgent.get("/api/transactions/admin/disputes");
  const disputeId = String(
    adminDisputesResponse.body.data.data.find(
      (dispute: { transaction: { id: string } }) => dispute.transaction.id === transactionId
    ).id
  );

  const resolutionResponse = await adminAgent
    .patch(`/api/transactions/admin/disputes/${disputeId}`)
    .send({
      status: "RESOLVED_FOR_BUYER",
      resolutionNotes: "Evidence favored the buyer.",
      adminInternalNotes: "Queue refund and close out seller release."
    });

  assert.equal(resolutionResponse.status, 200);
  assert.equal(
    resolutionResponse.body.data.transaction.sellerPayoutStatus,
    "REFUND_PENDING"
  );

  const refundResponse = await adminAgent.post(`/api/transactions/admin/${transactionId}/refund`).send({
    notes: "Refund issued by admin review."
  });

  assert.equal(refundResponse.status, 200);
  assert.equal(refundResponse.body.success, true);
  assert.equal(refundResponse.body.data.status, "REFUNDED");
  assert.equal(refundResponse.body.data.sellerPayoutStatus, "REFUNDED");
  assert.ok(refundResponse.body.data.refundReference);
});

test("transaction APIs allow retrying a previously blocked payout release", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const listing = await getListingBySlug("gaming-youtube-monetized");
  const buyerId = await getUserIdByEmail(seedCredentials.buyer.email);
  const sellerId = await getUserIdByEmail(seedCredentials.seller.email);

  await prisma.transaction.deleteMany({
    where: {
      buyerId,
      sellerId,
      listingId: listing.id,
      sellerPayoutStatus: "BLOCKED",
      sellerPayoutFailureReason: {
        not: null
      }
    }
  });

  const transaction = await prisma.transaction.create({
    data: {
      listingId: listing.id,
      buyerId,
      sellerId,
      agreedPrice: 1200,
      currency: "USD",
      status: "COMPLETED",
      sellerPayoutStatus: "BLOCKED",
      sellerPayoutFailureReason: "Previous Stripe transfer attempt failed.",
      stripeCheckoutSessionId: `demo_transaction_retry_${Date.now()}`
    }
  });

  const releaseResponse = await adminAgent
    .post(`/api/transactions/admin/${transaction.id}/release`)
    .send({
      notes: "Retrying payout after reviewing the earlier failure."
    });

  assert.equal(releaseResponse.status, 200);
  assert.equal(releaseResponse.body.success, true);
  assert.equal(releaseResponse.body.data.sellerPayoutStatus, "RELEASED");
  assert.equal(releaseResponse.body.data.sellerPayoutFailureReason, null);
  assert.ok(releaseResponse.body.data.sellerPayoutLastAttemptAt);
  assert.ok(releaseResponse.body.data.sellerPayoutReference);
});

test("transaction dispute case notes respect participant and admin-only visibility", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const buyerAgent = await loginAs(app, seedCredentials.buyer);
  const sellerAgent = await loginAs(app, seedCredentials.seller);
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const listing = await getListingBySlug("gaming-youtube-monetized");

  await ensureIdentityVerificationStatus(seedCredentials.buyer.email, "APPROVED");
  await ensureIdentityVerificationStatus(seedCredentials.seller.email, "APPROVED");

  await prisma.dispute.deleteMany({
    where: {
      transaction: {
        listingId: listing.id,
        buyer: {
          email: seedCredentials.buyer.email
        }
      }
    }
  });

  await prisma.transaction.deleteMany({
    where: {
      listingId: listing.id,
      buyer: {
        email: seedCredentials.buyer.email
      }
    }
  });

  const checkoutResponse = await buyerAgent.post("/api/transactions/checkout").send({
    listingId: listing.id,
    buyerNotes: `Case note visibility ${Date.now()}`
  });

  const transactionId = String(checkoutResponse.body.data.transaction.id);
  const sessionId = String(checkoutResponse.body.data.sessionId);

  await buyerAgent.post("/api/transactions/checkout/confirm").send({ sessionId });
  await sellerAgent.patch(`/api/transactions/${transactionId}/status`).send({
    status: "HANDOFF_SUBMITTED",
    notes: "Transfer package submitted."
  });

  const disputeResponse = await buyerAgent.post(`/api/transactions/${transactionId}/disputes`).send({
    reason: "Missing account assets",
    details: "The promised recovery documents were not included."
  });

  const disputeId = String(disputeResponse.body.data.disputes[0].id);

  const participantNoteResponse = await buyerAgent
    .post(`/api/transactions/disputes/${disputeId}/case-notes`)
    .send({
      message: "Buyer shared a participant-visible timeline update."
    });

  assert.equal(participantNoteResponse.status, 201);
  assert.equal(participantNoteResponse.body.success, true);
  assert.equal(
    participantNoteResponse.body.data.caseEvents.some(
      (event: { message: string; visibility: string }) =>
        event.message.includes("participant-visible timeline update") &&
        event.visibility === "participants"
    ),
    true
  );

  const adminNoteResponse = await adminAgent
    .post(`/api/transactions/disputes/${disputeId}/case-notes`)
    .send({
      message: "Ops escalated this case for finance review.",
      visibility: "admin_only"
    });

  assert.equal(adminNoteResponse.status, 201);
  assert.equal(adminNoteResponse.body.success, true);
  assert.equal(
    adminNoteResponse.body.data.caseEvents.some(
      (event: { message: string; visibility: string }) =>
        event.message.includes("finance review") && event.visibility === "admin_only"
    ),
    true
  );

  const buyerTransactionResponse = await buyerAgent.get(`/api/transactions/${transactionId}`);
  assert.equal(buyerTransactionResponse.status, 200);
  assert.equal(
    buyerTransactionResponse.body.data.disputes[0].caseEvents.some(
      (event: { visibility: string; message: string }) =>
        event.visibility === "admin_only" || event.message.includes("finance review")
    ),
    false
  );

  const adminDisputesResponse = await adminAgent.get("/api/transactions/admin/disputes");
  const adminDispute = adminDisputesResponse.body.data.data.find(
    (item: { id: string }) => item.id === disputeId
  );

  assert.equal(Boolean(adminDispute), true);
  assert.equal(
    adminDispute.caseEvents.some(
      (event: { visibility: string; message: string }) =>
        event.visibility === "admin_only" && event.message.includes("finance review")
    ),
    true
  );
});
