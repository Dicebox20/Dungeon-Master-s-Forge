import assert from "node:assert/strict";
import { compileItemRequest } from "../scripts/request-compiler.js";

const cases = [
  {
    name: "extra-damage weapon",
    kind: "weaponExtraDamage",
    request: "Emberglass Dagger\nUncommon magic dagger. Its attacks deal an extra 1d4 fire damage."
  },
  {
    name: "condition weapon",
    kind: "weaponConditionOnHit",
    request: "Venomwake Dagger\nLegendary +2 dagger requiring attunement. It deals an extra 1d6 poison damage. The target must make a DC 13 Constitution save or be poisoned for 30 seconds."
  },
  {
    name: "passive equipment",
    kind: "passiveEffectEquipment",
    request: "Ring of Steadfast Warding\nRare ring requiring attunement. It grants +1 to AC and saving throws."
  },
  {
    name: "magic shield",
    kind: "shieldArmorBonus",
    request: "Mossglass Shield\nRare +1 magic shield requiring attunement."
  },
  {
    name: "healing consumable",
    kind: "chargedHealing",
    request: "Dewdrop Vial\nUncommon consumable vial. As an action, drink it to heal 2d4 + 2 hit points. It has 1 use and is consumed."
  },
  {
    name: "save damage wand",
    kind: "chargedSaveDamage",
    request: "Wand of Thunderous Force\nUncommon wand requiring attunement. It has 7 charges and regains 1d6 + 1 charges at dawn. As an action, create a 15-foot cube. DC 13 Constitution save. It deals 2d8 thunder damage, half on success."
  },
  {
    name: "multi-spell staff",
    kind: "multiActivityStaff",
    request: "Staff of Winter's Judgment\nRare staff requiring attunement. It has 10 charges and DC 15. Cast Ice Storm for 4 charges and Cone of Cold for 5 charges. Regains 1d6 + 4 charges at dawn."
  },
  {
    name: "weapon enchantment",
    kind: "nativeEnchant",
    request: "Oil of Ember Edge\nUncommon consumable oil. As an action, apply it to one nonmagical weapon. For 1 hour it becomes magical and deals an extra 1d4 fire damage. One use, consumed."
  },
  {
    name: "grenade consumable",
    kind: "chargedSaveDamage",
    request: "Cinderburst Grenade\nRare grenade. As an action, throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere makes a DC 15 Dexterity save, taking 4d6 fire damage on a failed save, or half on a success. One use, consumed."
  },
  {
    name: "single summon",
    kind: "nativeSummon",
    request: "Moonhowl Whistle\nRare item. Once per long rest, summon a friendly wolf for 1 hour."
  },
  {
    name: "multi-profile summon",
    kind: "nativeMultiProfileSummon",
    request: "Infernal Calling Stone\nVery rare item requiring attunement. Once per long rest summon a friendly fiend, choosing Demon, Devil, or Yugoloth."
  },
  {
    name: "known utility spell equipment",
    kind: "casterUtilityEquipment",
    request: "Helm of Clairvoyant Aegis\nVery rare helm requiring attunement. It grants +1 to AC, spell attack, and spell DC and resistance to psychic damage. It casts Clairvoyance twice per short rest."
  },
  {
    name: "equipment attack",
    kind: "equipmentPowerSuite",
    request: "Mindshard Circlet\nVery rare circlet requiring attunement. It has 5 charges. As an action, spend 1 charge to make a ranged psychic attack using Intelligence against one enemy within 90 feet, dealing 4d8 psychic damage."
  },
  {
    name: "hybrid artifact",
    kind: "artifactWeaponHybrid",
    request: "Stormfire Reaver\n+3 artifact greataxe requiring attunement. Attacks deal an extra 1d6 fire and 1d6 lightning damage. It grants +1 AC. As a bonus action ignite 20 feet bright light and an additional 20 feet dim light. Once per dawn cast Flame Strike at DC 18 Dexterity for 4d6 fire and 4d6 radiant damage, half on success."
  },
  {
    name: "structured unresolved mechanics",
    kind: "passiveEffectEquipment",
    unresolved: ["allyAura", "classResource", "unmappedSpell"],
    request: "Crown of the Shared Aura\nLegendary crown requiring attunement. It emits a 30-foot aura granting allies +1 AC. It restores 1 sorcery point. It casts Fly once per dawn."
  }
];

for (const testCase of cases) {
  const result = compileItemRequest(testCase.request);
  const spec = result.specs[0];
  assert.equal(spec.kind, testCase.kind, `${testCase.name} routed to ${spec.kind}`);
  assert.ok(spec.name, `${testCase.name} has a name`);
  assert.ok(spec.description, `${testCase.name} retains its request description`);
  assert.ok(result.decisions[0], `${testCase.name} records a compiler decision`);
  if (testCase.unresolved) {
    assert.deepEqual(spec.unresolvedMechanics.map(mechanic => mechanic.category), testCase.unresolved);
    assert.ok(spec.unresolvedMechanics.every(mechanic => /^[A-Za-z0-9]{16}$/.test(mechanic.id)));
  }
}

export const testedPatternCount = cases.length;
