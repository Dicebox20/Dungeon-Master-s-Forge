import { compileItemRequest } from "./request-compiler.js";

const DIAGNOSTIC_CASES = Object.freeze([
  Object.freeze({
    name: "condition weapon",
    expectedKind: "weaponConditionOnHit",
    request: "Diagnostic Venom Dagger\nLegendary +2 dagger. It deals an extra 1d6 poison damage. The target must make a DC 13 Constitution save or be poisoned for 30 seconds."
  }),
  Object.freeze({
    name: "multi-spell charges",
    expectedKind: "multiActivityStaff",
    request: "Diagnostic Winter Staff\nRare staff with 10 charges and DC 15. Cast Ice Storm for 4 charges and Cone of Cold for 5 charges. Regains 1d6 + 4 charges at dawn."
  }),
  Object.freeze({
    name: "multi-profile summon",
    expectedKind: "nativeMultiProfileSummon",
    request: "Diagnostic Fiend Stone\nVery rare item. Summon a friendly Demon, Devil, or Yugoloth once per long rest."
  }),
  Object.freeze({
    name: "native enchantment",
    expectedKind: "nativeEnchant",
    request: "Diagnostic Ember Oil\nUncommon oil. Apply it to a nonmagical weapon for 1 hour. It becomes magical and deals an extra 1d4 fire damage. One use, consumed."
  }),
  Object.freeze({
    name: "hybrid artifact",
    expectedKind: "artifactWeaponHybrid",
    request: "Diagnostic Storm Axe\n+3 artifact greataxe. Attacks deal an extra 1d6 fire and 1d6 lightning damage. It grants +1 AC. As a bonus action ignite 20 feet bright light and 20 additional feet dim light. Once per dawn cast Flame Strike at DC 18 Dexterity for 4d6 fire and 4d6 radiant damage."
  }),
  Object.freeze({
    name: "unresolved provenance",
    expectedKind: "passiveEffectEquipment",
    expectedUnresolved: "allyAura",
    requestedText: "It emits a 30-foot aura granting allies +1 AC.",
    request: "Diagnostic Aura Crown\nRare crown. It emits a 30-foot aura granting allies +1 AC."
  })
]);

function runLocalDiagnostics() {
  const results = DIAGNOSTIC_CASES.map(testCase => {
    try {
      const compilation = compileItemRequest(testCase.request);
      const spec = compilation.specs[0];
      if (spec.kind !== testCase.expectedKind) {
        throw new Error(`Expected ${testCase.expectedKind}, received ${spec.kind}.`);
      }
      if (testCase.expectedUnresolved) {
        const mechanic = spec.unresolvedMechanics?.find(entry => entry.category === testCase.expectedUnresolved);
        if (!mechanic) throw new Error(`Missing ${testCase.expectedUnresolved} unresolved mechanic.`);
        if (testCase.requestedText && mechanic.requestedText !== testCase.requestedText) {
          throw new Error("Unresolved mechanic did not preserve the exact requested clause.");
        }
      }
      return { name: testCase.name, passed: true, kind: spec.kind, message: "Passed" };
    } catch (error) {
      return {
        name: testCase.name,
        passed: false,
        kind: "",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  const passed = results.filter(result => result.passed).length;
  return {
    passed,
    failed: results.length - passed,
    total: results.length,
    healthy: passed === results.length,
    results
  };
}

export { DIAGNOSTIC_CASES, runLocalDiagnostics };
