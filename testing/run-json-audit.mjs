import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.DMF_ENDPOINT ?? "https://dmforge.137-184-103-220.sslip.io/v1/forge/compile";
const promptPath = process.env.DMF_PROMPT_FILE ?? "./testing/TESTER_PROMPT_SWEEP_2026-07-23.md";
const outputPath = process.env.DMF_AUDIT_OUTPUT ?? path.join(process.env.TEMP ?? ".", "dmf-sweep-10-full-json-audit.json");
const promptSource = await fs.readFile(promptPath, "utf8");
const prompts = [...promptSource.matchAll(/```text\r?\n([\s\S]*?)```/g)]
  .map(match => match[1].trim())
  .map((prompt, index) => prompt.replace(/\[TEST-\d{2}\]/, `[RETEST-${String(index + 1).padStart(2, "0")}]`));

if (prompts.length !== 10) throw new Error(`Expected 10 prompts, found ${prompts.length}.`);

const routes = [
  { recipe: "conditionOnHit", layer: "Midi-QOL + Item Macro", selectedLayer: "Midi-QOL + Item Macro", dependencies: ["midi-qol", "itemacro"], available: true, status: "available", fallback: "Core attack workflow with review" },
  { recipe: "selfTargetLight", layer: "Item Macro", selectedLayer: "Item Macro", dependencies: ["itemacro"], available: true, status: "available", fallback: "Portable light metadata with review" },
  { recipe: "multiActivityResource", layer: "DND5e core", selectedLayer: "DND5e core", dependencies: [], available: true, status: "available", fallback: "DND5e core" },
  { recipe: "daeTransferEffect", layer: "Dynamic Active Effects", selectedLayer: "Dynamic Active Effects", dependencies: ["dae"], available: true, status: "available", fallback: "DND5e core effect with manual review" }
];
const context = {
  foundryVersion: "14.365",
  systemId: "dnd5e",
  systemVersion: "5.3.3",
  moduleVersion: "2.23.1-test.64",
  supportedKinds: [
    "artifactWeaponHybrid", "casterUtilityEquipment", "chargedHealing", "chargedSaveDamage",
    "equipmentPowerSuite", "legendaryEquipmentSuite", "multiActivityStaff", "nativeEnchant",
    "nativeMultiProfileSummon", "nativeSummon", "passiveEffectEquipment", "shieldArmorBonus",
    "weaponConditionOnHit", "weaponExtraDamage"
  ],
  automationCapabilities: {
    version: "1.0",
    supportedRecipes: routes.map(route => route.recipe),
    supportedTemplates: ["workflow-condition-rider", "self-token-light-toggle", "shared-charge-activity-set", "attunement-effect-transfer"],
    activeModules: ["midi-qol", "dae", "itemacro"],
    settings: { midiQolAutomation: true, itemMacroAutomation: true, daeAutomation: true },
    routes
  }
};
const expectedKinds = [
  ["weaponExtraDamage"], ["passiveEffectEquipment"], ["chargedHealing"], ["chargedSaveDamage"], ["multiActivityStaff", "equipmentPowerSuite"],
  ["weaponConditionOnHit"], ["artifactWeaponHybrid"], ["passiveEffectEquipment"], ["equipmentPowerSuite"], ["artifactWeaponHybrid"]
];
const isObject = value => value && typeof value === "object" && !Array.isArray(value);

function auditSpec(spec, index) {
  const findings = [];
  if (!spec) return ["missing_spec"];
  if (!expectedKinds[index].includes(spec.kind)) findings.push(`kind:${spec.kind ?? "missing"} expected ${expectedKinds[index].join(" or ")}`);
  if (index === 0 && (!Number(spec.magicalBonus) || !Array.isArray(spec.extraDamageParts) || !spec.extraDamageParts.length)) findings.push("missing +1 or extra damage");
  if (index === 1 && (!Array.isArray(spec.effects) || !spec.effects.length)) findings.push("missing passive effects");
  if (index === 2 && (String(spec.uses?.max) !== "1" || !isObject(spec.healing))) findings.push("missing one-use healing payload");
  if (index === 3 && (String(spec.uses?.max) !== "6" || !isObject(spec.save) || !Array.isArray(spec.damageParts))) findings.push("missing charged save payload");
  if (index === 4 && (String(spec.uses?.max) !== "8" || (!Array.isArray(spec.activities) && !Array.isArray(spec.attackActivities) && !Array.isArray(spec.saveActivities) && !Array.isArray(spec.utilityActivities)))) findings.push("missing shared multi-activity payload");
  if (index === 5 && (!isObject(spec.conditionOnHit) || spec.automation?.recipe !== "conditionOnHit")) findings.push("missing conditionOnHit automation contract");
  const lightActivities = [
    ...(Array.isArray(spec.utilityActivities) ? spec.utilityActivities : []),
    ...(Array.isArray(spec.multiActivityItems) ? spec.multiActivityItems : []),
  ];
  const hasLightRoute = Boolean(
    isObject(spec.toggleLight)
    || spec.automation?.recipe === "selfTargetLight"
    || lightActivities.some(activity => activity?.automation?.recipe === "selfTargetLight" || activity?.utility?.recipe === "selfTargetLight" || isObject(activity?.toggleLight))
  );
  if (index === 6 && (!lightActivities.length || !hasLightRoute)) findings.push("missing explicit selfTargetLight metadata");
  if (index === 7 && (!Array.isArray(spec.effects) || spec.effects.length < 1)) findings.push("missing attunement-gated effects");
  if (index === 8 && (String(spec.uses?.max) !== "10" || (!Array.isArray(spec.multiActivityItems) && !Array.isArray(spec.utilityActivities)) || !hasLightRoute)) findings.push("missing shared charges or light utility");
  if (index === 9 && (!isObject(spec.summonActivity) || !Array.isArray(spec.summonProfiles) || !spec.summonProfiles.length || !Array.isArray(spec.saveActivities))) findings.push("missing summon/save hybrid payload");
  if (index === 9 && (!isObject(spec.conditionOnHit) || spec.automation?.recipe !== "conditionOnHit")) findings.push("missing hybrid conditionOnHit automation contract");
  if (index === 9 && (!lightActivities.length || !hasLightRoute)) findings.push("missing hybrid selfTargetLight metadata");
  const unresolved = Array.isArray(spec.unresolvedMechanics) ? spec.unresolvedMechanics : [];
  if (index === 4 && unresolved.some(note => note.category === "saveDamage") && Array.isArray(spec.activities) && spec.activities.some(activity => isObject(activity.save) && Array.isArray(activity.damageParts))) findings.push("stale saveDamage review note");
  if ((index === 8 || index === 9) && unresolved.some(note => note.category === "lightToggle") && hasLightRoute) findings.push("stale lightToggle review note");
  return findings;
}

const results = [];
for (let index = 0; index < prompts.length; index += 1) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ schemaVersion: "1.0", request: prompts[index], context, options: { model: "", unresolvedPolicy: "review" } })
  });
  const payload = await response.json();
  const spec = payload.specs?.[0] ?? null;
  const findings = auditSpec(spec, index);
  results.push({ case: index + 1, prompt: prompts[index], status: response.status, cache: response.headers.get("x-forge-cache"), payload, audit: { passed: response.ok && findings.length === 0, findings } });
  if (index < prompts.length - 1) await new Promise(resolve => setTimeout(resolve, 7000));
}

await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), endpoint, results }, null, 2));
console.log(JSON.stringify({
  outputPath,
  cases: results.map(result => ({
    case: result.case,
    status: result.status,
    cache: result.cache,
    name: result.payload?.specs?.[0]?.name ?? null,
    kind: result.payload?.specs?.[0]?.kind ?? null,
    unresolved: result.payload?.specs?.[0]?.unresolvedMechanics?.length ?? 0,
    passedJsonAudit: result.audit.passed,
    findings: result.audit.findings
  })),
  passedJsonAudits: results.filter(result => result.audit.passed).length,
  failedJsonAudits: results.filter(result => !result.audit.passed).length
}, null, 2));
