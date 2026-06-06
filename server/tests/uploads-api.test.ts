import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/core/app.js";
import {
  canReachDatabase,
  loginAs,
  seedCredentials,
  tinyPngBase64
} from "./test-helpers.js";

test("upload API accepts valid seller uploads and rejects invalid or unauthorized requests", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const sellerAgent = await loginAs(app, seedCredentials.seller);
  const buyerAgent = await loginAs(app, seedCredentials.buyer);

  const successResponse = await sellerAgent.post("/api/uploads").send({
    fileName: "proof.png",
    mimeType: "image/png",
    contentBase64: tinyPngBase64
  });

  assert.equal(successResponse.status, 201);
  assert.equal(successResponse.body.success, true);
  assert.equal(successResponse.body.data.fileName.endsWith(".png"), true);
  assert.equal(typeof successResponse.body.data.fileUrl, "string");
  assert.match(successResponse.body.data.storageProvider, /^(local|supabase)$/);

  const invalidSignatureResponse = await sellerAgent.post("/api/uploads").send({
    fileName: "fake.png",
    mimeType: "image/png",
    contentBase64: Buffer.from("not-a-real-png", "utf8").toString("base64")
  });

  assert.equal(invalidSignatureResponse.status, 400);
  assert.equal(invalidSignatureResponse.body.success, false);
  assert.match(
    invalidSignatureResponse.body.message,
    /does not match the declared file type/i
  );

  const buyerForbiddenResponse = await buyerAgent.post("/api/uploads").send({
    fileName: "proof.png",
    mimeType: "image/png",
    contentBase64: tinyPngBase64
  });

  assert.equal(buyerForbiddenResponse.status, 403);
  assert.equal(buyerForbiddenResponse.body.success, false);
  assert.match(buyerForbiddenResponse.body.message, /permission/i);
});
