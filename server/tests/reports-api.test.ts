import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/core/app.js";
import { prisma } from "../src/config/prisma.js";
import {
  canReachDatabase,
  getListingBySlug,
  getUserIdByEmail,
  loginAs,
  seedCredentials
} from "./test-helpers.js";

test("report APIs cover create, admin review, listing action, and audit visibility", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const buyerAgent = await loginAs(app, seedCredentials.buyer);
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const listing = await getListingBySlug("crypto-x-account-87k");

  await prisma.listing.update({
    where: {
      id: listing.id
    },
    data: {
      status: "ACTIVE"
    }
  });

  await prisma.report.deleteMany({
    where: {
      reporter: {
        email: seedCredentials.buyer.email
      },
      listingId: listing.id
    }
  });

  const createResponse = await buyerAgent.post("/api/reports").send({
    listingId: listing.id,
    reason: "Misleading performance claims",
    details: `Suspicious metrics sample ${Date.now()}`
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.success, true);
  assert.equal(createResponse.body.data.listing.id, listing.id);
  assert.equal(createResponse.body.data.status, "OPEN");

  const reportId = String(createResponse.body.data.id);

  const adminListResponse = await adminAgent.get("/api/reports/admin");
  assert.equal(adminListResponse.status, 200);
  assert.ok(
    adminListResponse.body.data.data.some((report: { id: string }) => report.id === reportId)
  );

  const reviewResponse = await adminAgent.patch(`/api/reports/admin/${reportId}`).send({
    status: "RESOLVED",
    resolutionNotes: "Confirmed issue and removed listing from live marketplace.",
    listingAction: "REJECTED"
  });

  assert.equal(reviewResponse.status, 200);
  assert.equal(reviewResponse.body.success, true);
  assert.equal(reviewResponse.body.data.status, "RESOLVED");

  const refreshedListing = await prisma.listing.findUniqueOrThrow({
    where: {
      id: listing.id
    },
    select: {
      status: true
    }
  });

  assert.equal(refreshedListing.status, "REJECTED");

  const myReportsResponse = await buyerAgent.get("/api/reports/mine");
  assert.equal(myReportsResponse.status, 200);
  assert.ok(
    myReportsResponse.body.data.data.some(
      (report: { id: string; status: string }) => report.id === reportId && report.status === "RESOLVED"
    )
  );

  const auditResponse = await adminAgent.get("/api/audit-logs/admin?limit=100");
  assert.equal(auditResponse.status, 200);
  assert.ok(
    auditResponse.body.data.data.some(
      (entry: { action: string; entityId: string }) =>
        entry.action === "report.reviewed" && entry.entityId === reportId
    )
  );
});

test("report APIs cover suspicious user reports and admin review without listing action", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const buyerAgent = await loginAs(app, seedCredentials.buyer);
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const sellerId = await getUserIdByEmail(seedCredentials.seller.email);

  await prisma.report.deleteMany({
    where: {
      reporter: {
        email: seedCredentials.buyer.email
      },
      reportedUserId: sellerId
    }
  });

  const createResponse = await buyerAgent.post("/api/reports").send({
    reportedUserId: sellerId,
    reason: "Repeated scam risk signals",
    details: `Seller repeatedly pushed off-platform communication ${Date.now()}`
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.success, true);
  assert.equal(createResponse.body.data.targetType, "USER");
  assert.equal(createResponse.body.data.reportedUser.id, sellerId);
  assert.equal(createResponse.body.data.listing, null);

  const reportId = String(createResponse.body.data.id);

  const adminListResponse = await adminAgent.get("/api/reports/admin");
  assert.equal(adminListResponse.status, 200);
  assert.ok(
    adminListResponse.body.data.data.some(
      (report: { id: string; targetType: string; reportedUser: { id: string } | null }) =>
        report.id === reportId &&
        report.targetType === "USER" &&
        report.reportedUser?.id === sellerId
    )
  );

  const reviewResponse = await adminAgent.patch(`/api/reports/admin/${reportId}`).send({
    status: "UNDER_REVIEW",
    resolutionNotes: "Ops is reviewing the seller's recent behavior.",
    listingAction: "NONE"
  });

  assert.equal(reviewResponse.status, 200);
  assert.equal(reviewResponse.body.success, true);
  assert.equal(reviewResponse.body.data.targetType, "USER");
  assert.equal(reviewResponse.body.data.status, "UNDER_REVIEW");

  const invalidReviewResponse = await adminAgent.patch(`/api/reports/admin/${reportId}`).send({
    status: "RESOLVED",
    resolutionNotes: "Attempted invalid listing action for a user report.",
    listingAction: "REJECTED"
  });

  assert.equal(invalidReviewResponse.status, 400);

  const myReportsResponse = await buyerAgent.get("/api/reports/mine");
  assert.equal(myReportsResponse.status, 200);
  assert.ok(
    myReportsResponse.body.data.data.some(
      (report: { id: string; targetType: string; reportedUser: { id: string } | null }) =>
        report.id === reportId &&
        report.targetType === "USER" &&
        report.reportedUser?.id === sellerId
    )
  );
});
