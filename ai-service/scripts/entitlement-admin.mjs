import { signPaidEntitlement, verifyPaidEntitlement } from "../src/paid-entitlement.mjs";

function usage() {
  console.log([
    "Usage:",
    "  node scripts/entitlement-admin.mjs issue --subject <opaque-id> --tier supporter|founding-patron --days <count>",
    "  node scripts/entitlement-admin.mjs verify --token <token>",
    "",
    "Environment:",
    "  DMF_PAID_ENTITLEMENT_SECRET  Server-only secret used to sign and verify tokens."
  ].join("\n"));
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] ?? "").trim() : "";
}

const command = String(process.argv[2] ?? "").trim().toLowerCase();
if (["", "-h", "--help", "help"].includes(command)) {
  usage();
  process.exit(command ? 0 : 1);
}

const secret = String(process.env.DMF_PAID_ENTITLEMENT_SECRET ?? "");
if (secret.length < 32) {
  console.error("DMF_PAID_ENTITLEMENT_SECRET must contain at least 32 characters.");
  process.exit(1);
}

if (command === "issue") {
  const subject = argument("--subject");
  const tier = argument("--tier").toLowerCase();
  const days = Number(argument("--days"));
  if (!subject || !["supporter", "founding-patron"].includes(tier) || !Number.isInteger(days) || days < 1 || days > 366) {
    console.error("Issue requires an opaque subject, a supported tier, and 1-366 days.");
    usage();
    process.exit(1);
  }
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const token = signPaidEntitlement({ sub: subject, tier, exp }, secret);
  console.log(JSON.stringify({ tier, expiresAt: new Date(exp * 1000).toISOString(), token }, null, 2));
  process.exit(0);
}

if (command === "verify") {
  const result = verifyPaidEntitlement(argument("--token"), secret);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "valid" ? 0 : 1);
}

console.error(`Unknown entitlement-admin command "${command}".`);
usage();
process.exit(1);
