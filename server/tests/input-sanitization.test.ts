import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeForValidation } from "../src/utils/sanitize.js";

test("sanitizeForValidation strips unsafe markup from free-text fields but preserves verbatim secrets", () => {
  const payload = {
    fullName: "  <script>alert(1)</script> Yash \u0007 ",
    bio: "Hello <b>world</b>\r\n  with extra spacing  ",
    password: "  <KeepThisExactly>  ",
    nested: {
      note: "Proof <img src=x onerror=alert(1)> ready"
    },
    media: [
      {
        caption: "First <i>proof</i>"
      }
    ],
    contentBase64: "  ZmFrZS1iYXNlNjQ=  "
  };

  const result = sanitizeForValidation(payload);

  assert.equal(result.fullName, "alert(1) Yash");
  assert.equal(result.bio, "Hello world\nwith extra spacing");
  assert.equal(result.password, "  <KeepThisExactly>  ");
  assert.equal(result.nested.note, "Proof ready");
  assert.equal(result.media[0]?.caption, "First proof");
  assert.equal(result.contentBase64, "  ZmFrZS1iYXNlNjQ=  ");
});
