/*
 * Dungeon Master's Forge V2 test request.
 * Requires Dungeon Master's Forge V2 (2.0.0), Midi-QOL, and Item Macro.
 */

const forge = game.modules.get("dungeon-masters-forge")?.api;
if (!forge) {
  ui.notifications.error("Dungeon Master's Forge V2 is not active.");
  return;
}

const restoreKiMacro = `
const expectedActivityId = "RestoreKi0000001";
const macroScope = typeof scope !== "undefined" ? scope : {};
const macroWorkflow = typeof workflow !== "undefined" ? workflow : macroScope.workflow ?? null;
const rolledActivityId = macroScope.rolledActivity?.id ?? macroWorkflow?.activity?.id ?? null;

if (rolledActivityId !== expectedActivityId) return;

const macroItem = typeof item !== "undefined" ? item : null;
const macroActor = typeof actor !== "undefined" ? actor : macroItem?.parent ?? null;

if (!macroActor) {
  ui.notifications.warn("Restore 1 Ki requires an actor-owned staff.");
  return;
}

const actorItems = Array.from(macroActor.items ?? []);
const isMonk = actorItems.some(candidate => {
  if (candidate.type !== "class") return false;
  const identifier = String(candidate.system?.identifier ?? "").toLowerCase();
  return identifier === "monk" || String(candidate.name ?? "").trim().toLowerCase() === "monk";
});

if (!isMonk) {
  ui.notifications.warn(macroActor.name + " is not recognized as a monk.");
  return;
}

function resourceScore(candidate) {
  const uses = candidate.system?.uses;
  if (!uses || uses.max === null || uses.max === undefined || uses.max === "") return -1;

  const identifier = String(candidate.system?.identifier ?? "").toLowerCase();
  const name = String(candidate.name ?? "").trim().toLowerCase();
  if (["ki", "ki-points", "focus-points", "monks-focus"].includes(identifier)) return 4;
  if (["ki", "ki points", "focus points", "monk's focus"].includes(name)) return 3;
  if (/\\bki\\b/.test(identifier) || /\\bki\\b/.test(name)) return 2;
  if (/focus/.test(identifier) || /focus/.test(name)) return 1;
  return -1;
}

const resource = actorItems
  .map(candidate => ({ candidate, score: resourceScore(candidate) }))
  .filter(entry => entry.score >= 0)
  .sort((a, b) => b.score - a.score)[0]?.candidate;

if (!resource) {
  ui.notifications.warn("No Ki Points or Focus Points feature with uses was found on " + macroActor.name + ".");
  return;
}

const uses = resource.system.uses;
if ("spent" in uses) {
  const spent = Number(uses.spent ?? 0);
  if (spent <= 0) {
    ui.notifications.info(macroActor.name + " has no spent " + resource.name + " to restore.");
    return;
  }
  await resource.update({ "system.uses.spent": Math.max(0, spent - 1) });
} else {
  const value = Number(uses.value ?? 0);
  const max = Number(uses.max ?? value);
  if (Number.isFinite(max) && value >= max) {
    ui.notifications.info(macroActor.name + " is already at maximum " + resource.name + ".");
    return;
  }
  await resource.update({ "system.uses.value": value + 1 });
}

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: macroActor }),
  content: "<p><strong>" + (macroItem?.name ?? "Staff") + ":</strong> " + macroActor.name + " restores 1 " + resource.name + ".</p>"
});
ui.notifications.info(macroActor.name + " restores 1 " + resource.name + ".");
`.trim();

const result = await forge.create([
  {
    kind: "artifactWeaponHybrid",
    name: "Staff of the Flowing Force V2",
    img: "icons/weapons/staves/staff-blue-jewel.webp",
    description: "This balanced quarterstaff hums with disciplined force. Its strikes deal an extra 2d4 force damage. A monk wielding the staff can use its power to restore 1 expended Ki Point or Focus Point.",
    rarity: "veryRare",
    attunement: "",
    weaponType: "simpleM",
    baseItem: "quarterstaff",
    properties: ["mgc", "ver"],
    mastery: "topple",
    magicalBonus: "",
    weight: 4,
    range: { reach: 5, units: "ft" },
    damage: {
      base: { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"] },
      versatile: { number: 1, denomination: 8, bonus: "@mod", types: ["bludgeoning"] }
    },
    extraDamageParts: [
      { number: 2, denomination: 4, bonus: "", types: ["force"] }
    ],
    attackName: "Strike with the Staff of the Flowing Force V2",
    utilityActivities: [
      {
        activityId: "RestoreKi0000001",
        activityName: "Restore 1 Ki",
        activityImg: "icons/magic/control/buff-flight-wings-blue.webp",
        activationType: "action",
        chatFlavor: "The staff turns disciplined force inward, restoring 1 expended Ki Point or Focus Point.",
        range: { units: "self" },
        target: { affects: { count: "1", type: "self" }, prompt: false },
        requireMagic: false,
        macroName: "Restore 1 Ki",
        macroCommand: restoreKiMacro
      }
    ]
  }
]);

const createdStaff = result.items[0];
const activitySummary = Array.from(createdStaff.system.activities ?? []).map(activity => ({
  id: activity.id,
  name: activity.name,
  type: activity.type,
  canUse: activity.canUse
}));
console.table(activitySummary);

const recoveryActivity = Array.from(createdStaff.system.activities ?? []).find(activity =>
  activity.id === "RestoreKi0000001"
);
if (!recoveryActivity) {
  throw new Error("Staff of the Flowing Force V2 was created without its Restore 1 Ki activity.");
}
if (!recoveryActivity.canUse) {
  throw new Error("Restore 1 Ki exists but Foundry marked it unavailable.");
}

ui.notifications.info("Staff of the Flowing Force V2 created with separate Strike and Restore 1 Ki activities.");
