import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/core/app.js";

test("GET /api/health returns service status and request id", async () => {
  const app = createApp();

  const response = await request(app)
    .get("/api/health")
    .set("x-request-id", "health-test-request");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.body.data.requestId, "health-test-request");
  assert.equal(response.headers["x-request-id"], "health-test-request");
  assert.equal(typeof response.body.data.uptimeSeconds, "number");
});
