import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/core/app.js";
import { getListingBySlug, canReachDatabase, loginAs, seedCredentials } from "./test-helpers.js";

test("conversation APIs cover create, inbox state, read flow, reply flow, and access control", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const buyerAgent = await loginAs(app, seedCredentials.buyer);
  const sellerAgent = await loginAs(app, seedCredentials.seller);
  const adminAgent = await loginAs(app, seedCredentials.admin);
  const listing = await getListingBySlug("travel-instagram-240k");
  const initialMessage = `Interested in this asset ${Date.now()}`;

  const createResponse = await buyerAgent.post("/api/conversations").send({
    listingId: listing.id,
    initialMessage
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.success, true);
  assert.equal(createResponse.body.data.listing.id, listing.id);
  assert.ok(
    createResponse.body.data.messages.some(
      (message: { messageText: string }) => message.messageText === initialMessage
    )
  );

  const conversationId = String(createResponse.body.data.id);

  const sellerInboxResponse = await sellerAgent.get("/api/conversations");
  assert.equal(sellerInboxResponse.status, 200);
  assert.equal(sellerInboxResponse.body.success, true);

  const sellerConversation = sellerInboxResponse.body.data.find(
    (conversation: { id: string }) => conversation.id === conversationId
  );

  assert.ok(sellerConversation, "expected seller inbox to include the buyer conversation");
  assert.ok(
    sellerConversation.unreadCount >= 1,
    "expected seller to have at least one unread message before reading"
  );

  const sellerThreadResponse = await sellerAgent.get(`/api/conversations/${conversationId}`);
  assert.equal(sellerThreadResponse.status, 200);
  assert.equal(sellerThreadResponse.body.success, true);
  assert.equal(sellerThreadResponse.body.data.id, conversationId);

  const readResponse = await sellerAgent.patch(`/api/conversations/${conversationId}/read`).send({});
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.success, true);
  assert.equal(readResponse.body.data.unreadCount, 0);

  const replyText = `Thanks, sharing details shortly ${Date.now()}`;
  const replyResponse = await sellerAgent
    .post(`/api/conversations/${conversationId}/messages`)
    .send({
      messageText: replyText
    });

  assert.equal(replyResponse.status, 200);
  assert.equal(replyResponse.body.success, true);
  assert.ok(
    replyResponse.body.data.messages.some(
      (message: { messageText: string }) => message.messageText === replyText
    )
  );

  const buyerThreadResponse = await buyerAgent.get(`/api/conversations/${conversationId}`);
  assert.equal(buyerThreadResponse.status, 200);
  assert.ok(
    buyerThreadResponse.body.data.messages.some(
      (message: { messageText: string }) => message.messageText === replyText
    )
  );
  assert.ok(
    buyerThreadResponse.body.data.unreadCount >= 1,
    "expected buyer to see the unread seller reply before marking as read"
  );

  const forbiddenResponse = await adminAgent.get(`/api/conversations/${conversationId}`);
  assert.equal(forbiddenResponse.status, 403);
  assert.equal(forbiddenResponse.body.success, false);
});
