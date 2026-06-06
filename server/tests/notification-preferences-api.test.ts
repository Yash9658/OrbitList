import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/config/prisma.js";
import { createApp } from "../src/core/app.js";
import { createNotificationRecord } from "../src/modules/notifications/notifications.service.js";
import { canReachDatabase, loginAs, seedCredentials } from "./test-helpers.js";

test("notification preferences suppress in-app message alerts while leaving marketplace alerts available", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const sellerAgent = await loginAs(app, seedCredentials.seller);
  const sellerId = (
    await prisma.user.findUniqueOrThrow({
      where: {
        email: seedCredentials.seller.email
      },
      select: {
        id: true
      }
    })
  ).id;
  await prisma.notification.deleteMany({
    where: {
      userId: sellerId
    }
  });

  const disableResponse = await sellerAgent.patch("/api/auth/profile").send({
    fullName: "Aarav Seller",
    notificationPreferences: {
      inAppMessages: false,
      inAppMarketplace: true,
      inAppTransactions: true,
      inAppTrust: true,
      emailMessages: true,
      emailMarketplace: true,
      emailTransactions: true,
      emailTrust: true,
      emailBilling: true
    }
  });

  assert.equal(disableResponse.status, 200);
  assert.equal(disableResponse.body.success, true);
  assert.equal(disableResponse.body.data.notificationPreferences.inAppMessages, false);

  await createNotificationRecord({
    userId: sellerId,
    type: "message",
    title: "Message preference test",
    body: `This message notification should be suppressed ${Date.now()}`
  });

  const afterMessageNotification = await prisma.notification.count({
    where: {
      userId: sellerId
    }
  });

  assert.equal(afterMessageNotification, 0);

  await createNotificationRecord({
    userId: sellerId,
    type: "listing_approved",
    title: "Marketplace preference test",
    body: `This marketplace notification should remain visible ${Date.now()}`
  });

  const sellerNotificationsResponse = await sellerAgent.get("/api/notifications");
  assert.equal(sellerNotificationsResponse.status, 200);
  assert.equal(sellerNotificationsResponse.body.success, true);
  assert.equal(
    sellerNotificationsResponse.body.data.some((notification: { type: string }) => notification.type === "message"),
    false
  );
  assert.equal(
    sellerNotificationsResponse.body.data.some(
      (notification: { type: string }) => notification.type === "listing_approved"
    ),
    true
  );

  const restoreResponse = await sellerAgent.patch("/api/auth/profile").send({
    fullName: "Aarav Seller",
    notificationPreferences: {
      inAppMessages: true,
      inAppMarketplace: true,
      inAppTransactions: true,
      inAppTrust: true,
      emailMessages: true,
      emailMarketplace: true,
      emailTransactions: true,
      emailTrust: true,
      emailBilling: true
    }
  });

  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.success, true);
  assert.equal(restoreResponse.body.data.notificationPreferences.inAppMessages, true);
});
