import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/core/app.js";

test("GET /api/health/readiness/phase-1 exposes launch-safety readiness details", async () => {
  const app = createApp();

  const response = await request(app).get("/api/health/readiness/phase-1");

  assert.equal([200, 503].includes(response.status), true);
  assert.equal(typeof response.body.data.phase, "string");
  assert.equal(response.body.data.phase, "Phase 1: Launch Safety");
  assert.match(response.body.data.status, /^(ready|warning|blocked)$/);
  assert.equal(Array.isArray(response.body.data.items), true);
  assert.equal(response.body.data.items.length > 0, true);
  assert.equal(
    response.body.data.items.some((item: { key: string }) => item.key === "uploads"),
    true
  );
  assert.equal(
    response.body.data.items.some((item: { key: string }) => item.key === "email_delivery"),
    true
  );
});
