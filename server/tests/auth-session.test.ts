import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/core/app.js";
import { canReachDatabase } from "./test-helpers.js";

test("auth session sets cookies, allows /me, and is cleared on logout", async (t) => {
  if (!(await canReachDatabase())) {
    t.skip("Local PostgreSQL is not running on port 5433");
    return;
  }

  const app = createApp();
  const agent = request.agent(app);

  const loginResponse = await agent.post("/api/auth/login").send({
    email: "seller@orbitlist.dev",
    password: "Orbitlist123!"
  });

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.success, true);
  assert.equal(loginResponse.body.data.email, "seller@orbitlist.dev");

  const setCookie = loginResponse.headers["set-cookie"] ?? [];
  const cookieString = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
  assert.match(cookieString, /orbitlist_access=/);
  assert.match(cookieString, /orbitlist_refresh=/);

  const meResponse = await agent.get("/api/auth/me");
  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.data.email, "seller@orbitlist.dev");

  const logoutResponse = await agent.post("/api/auth/logout").send({});
  assert.equal(logoutResponse.status, 200);
  assert.equal(logoutResponse.body.data.success, true);

  const meAfterLogoutResponse = await agent.get("/api/auth/me");
  assert.equal(meAfterLogoutResponse.status, 401);
});
