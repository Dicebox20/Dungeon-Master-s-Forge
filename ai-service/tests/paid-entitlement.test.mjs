import assert from "node:assert/strict";
import test from "node:test";
import {
  signPaidEntitlement,
  verifyPaidEntitlement
} from "../src/paid-entitlement.mjs";

const secret = "test-paid-entitlement-secret-at-least-32-characters";

test("paid entitlement tokens verify without exposing provider secrets", () => {
  const token = signPaidEntitlement({
    sub: "opaque-member-001",
    tier: "founding-patron",
    exp: 2000000000,
    iat: 1900000000
  }, secret);
  const result = verifyPaidEntitlement(token, secret, 1950000000000);
  assert.equal(result.status, "valid");
  assert.deepEqual(result.entitlement, {
    subject: "opaque-member-001",
    tier: "founding-patron",
    expiresAt: "2033-05-18T03:33:20.000Z"
  });
  assert.doesNotMatch(token, /test-paid-entitlement/);
});

test("paid entitlement verification rejects tampering and expiry", () => {
  const token = signPaidEntitlement({
    sub: "opaque-member-002",
    tier: "supporter",
    exp: 2000000000
  }, secret);
  const [payload, signature] = token.split(".");
  const tampered = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}.${signature}`;
  assert.equal(verifyPaidEntitlement(tampered, secret, 1900000000000).status, "invalid");
  assert.equal(verifyPaidEntitlement(token, secret, 2000000000000).status, "invalid");
  assert.equal(verifyPaidEntitlement("", secret).status, "missing");
});
