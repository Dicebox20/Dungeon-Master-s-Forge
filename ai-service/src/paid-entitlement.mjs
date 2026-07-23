import { createHmac, timingSafeEqual } from "node:crypto";

const PAID_ENTITLEMENT_VERSION = "1";
const PAID_ENTITLEMENT_AUDIENCE = "dungeon-masters-forge";
const PAID_ENTITLEMENT_TIERS = new Set(["supporter", "founding-patron"]);

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value) {
  return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
}

function signatureFor(payload, secret) {
  return createHmac("sha256", String(secret)).update(payload).digest("base64url");
}

function signPaidEntitlement(claims, secret) {
  if (String(secret ?? "").length < 32) throw new Error("A paid entitlement secret with at least 32 characters is required.");
  const subject = String(claims?.sub ?? "").trim();
  const tier = String(claims?.tier ?? "").trim().toLowerCase();
  const exp = Number(claims?.exp ?? 0);
  if (!subject || !PAID_ENTITLEMENT_TIERS.has(tier) || !Number.isInteger(exp) || exp <= 0) {
    throw new Error("Paid entitlements require an opaque subject, a supported tier, and an expiry timestamp.");
  }
  const payload = encode({
    v: PAID_ENTITLEMENT_VERSION,
    aud: PAID_ENTITLEMENT_AUDIENCE,
    sub: subject,
    tier,
    iat: Number.isInteger(Number(claims?.iat)) ? Number(claims.iat) : Math.floor(Date.now() / 1000),
    exp
  });
  return `${payload}.${signatureFor(payload, secret)}`;
}

function verifyPaidEntitlement(token, secret, now = Date.now()) {
  const raw = String(token ?? "").trim();
  if (!raw) return { status: "missing", entitlement: null };
  if (String(secret ?? "").length < 32) return { status: "unavailable", entitlement: null };

  const [payload, signature, ...extra] = raw.split(".");
  if (!payload || !signature || extra.length) return { status: "invalid", entitlement: null };
  const expected = signatureFor(payload, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return { status: "invalid", entitlement: null };
  }

  let claims;
  try {
    claims = decode(payload);
  } catch {
    return { status: "invalid", entitlement: null };
  }
  const exp = Number(claims?.exp ?? 0);
  const subject = String(claims?.sub ?? "").trim();
  const tier = String(claims?.tier ?? "").trim().toLowerCase();
  if (claims?.v !== PAID_ENTITLEMENT_VERSION
    || claims?.aud !== PAID_ENTITLEMENT_AUDIENCE
    || !subject
    || !PAID_ENTITLEMENT_TIERS.has(tier)
    || !Number.isInteger(exp)
    || exp <= Math.floor(Number(now) / 1000)) {
    return { status: "invalid", entitlement: null };
  }
  return {
    status: "valid",
    entitlement: {
      subject,
      tier,
      expiresAt: new Date(exp * 1000).toISOString()
    }
  };
}

export {
  PAID_ENTITLEMENT_AUDIENCE,
  PAID_ENTITLEMENT_TIERS,
  PAID_ENTITLEMENT_VERSION,
  signPaidEntitlement,
  verifyPaidEntitlement
};
