import { MODULE_ID } from "./package-identity.js";

const SCENE_REGION_SCHEMA_VERSION = "1.0";
const SCENE_REGION_FLAG = "sceneRegion";
const SAFE_BEHAVIOR_TYPES = Object.freeze([
  "adjustDarknessLevel",
  "applyActiveEffect",
  "displayScrollingText",
  "dnd5e.difficultTerrain",
  "modifyMovementCost",
  "pauseGame",
  "suppressWeather"
]);

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function movementMultiplier(text) {
  const numeric = text.match(/\b(?:movement|moving|travel)\s+(?:costs?|uses?)\s+(\d+(?:\.\d+)?)\s*(?:x|times?)\b/i)
    ?? text.match(/\b(\d+(?:\.\d+)?)\s*(?:x|times?)\s+(?:movement|moving|travel)\b/i);
  if (numeric) return clamp(Number(numeric[1]), 0, 5);
  if (/\btriple\s+(?:movement|moving|travel)|(?:movement|moving|travel)\s+costs?\s+triple\b/i.test(text)) return 3;
  if (/\bdouble\s+(?:movement|moving|travel)|(?:movement|moving|travel)\s+costs?\s+double\b/i.test(text)) return 2;
  return null;
}

function darknessLevel(text) {
  if (/\b(?:full|complete|total)\s+darkness\b/i.test(text)) return 1;
  if (/\b(?:dim|shadowy)\s+(?:light|darkness)\b/i.test(text)) return 0.5;
  const match = text.match(/\bdarkness(?:\s+level)?\s*(?:of|to|at|:)?\s*(0(?:\.\d+)?|1(?:\.0+)?)\b/i);
  return match ? clamp(Number(match[1]), 0, 1) : null;
}

function scrollingText(text) {
  const quoted = text.match(/\b(?:display|show|scroll|say)\s+(?:the\s+)?(?:text\s+)?["']([^"']{1,160})["']/i);
  if (quoted) return quoted[1].trim();
  const labeled = text.match(/\b(?:display|show|scroll)\s+text\s*:\s*([^\n]{1,160})/i);
  return labeled ? labeled[1].trim() : "";
}

function behavior(key, name, type, system = {}) {
  return { key, name, type, system };
}

function compileSceneRegionRequest(request, {
  effectUuids = [],
  effectSourceName = "",
  movementActions = ["walk", "fly", "swim", "climb", "burrow"]
} = {}) {
  const text = String(request ?? "").trim();
  if (!text) throw new Error("Describe what the selected Scene Region should do.");
  if (/\b(?:execute|run)\s+(?:a\s+)?(?:script|javascript|code)|\bmacro\s+(?:source|code)\b/i.test(text)) {
    throw new Error("Scene Region Forge does not generate scripts or macro source.");
  }

  const behaviors = [];
  const assumptions = [];
  const warnings = [];
  const multiplier = movementMultiplier(text);
  const wantsDifficultTerrain = /\bdifficult terrain\b|\b(?:mud|bog|rubble|undergrowth)\b.*\bslow/i.test(text);

  if (multiplier != null) {
    const difficulties = Object.fromEntries(movementActions.map(action => [action, multiplier]));
    behaviors.push(behavior("movement-cost", `Forge: ${multiplier}x Movement Cost`, "modifyMovementCost", { difficulties }));
  } else if (wantsDifficultTerrain) {
    behaviors.push(behavior("difficult-terrain", "Forge: Difficult Terrain", "dnd5e.difficultTerrain", {
      magical: /\bmagical\s+difficult terrain\b/i.test(text),
      types: [],
      ignoredDispositions: []
    }));
  }

  const darkness = darknessLevel(text);
  if (darkness != null) {
    behaviors.push(behavior("darkness", "Forge: Darkness", "adjustDarknessLevel", { mode: 0, modifier: darkness }));
  }

  if (/\b(?:suppress|block|stop|keep out)\s+(?:the\s+)?weather\b|\b(?:indoors|roofed)\b.*\bweather\b/i.test(text)) {
    behaviors.push(behavior("weather", "Forge: Suppress Weather", "suppressWeather", {}));
  }

  if (/\bpause\s+(?:the\s+)?game\b|\bstop\s+players?\b/i.test(text)) {
    behaviors.push(behavior("pause", "Forge: Pause Game", "pauseGame", {
      once: /\bonce\b|\bone[- ]shot\b|\bfirst time\b/i.test(text)
    }));
  }

  const message = scrollingText(text);
  if (message) {
    behaviors.push(behavior("scrolling-text", "Forge: Scrolling Text", "displayScrollingText", {
      events: ["tokenAnimateIn"],
      text: message,
      color: "#ffffff",
      visibility: 2,
      once: /\bonce\b|\bone[- ]shot\b|\bfirst time\b/i.test(text)
    }));
  }

  const wantsEffects = /\b(?:apply|grant|give|inflict)\b.*\b(?:effects?|conditions?|buffs?|debuffs?|auras?)\b|\b(?:effects?|conditions?|buffs?|debuffs?|auras?)\b.*\b(?:inside|within|enter)/i.test(text);
  if (wantsEffects && effectUuids.length) {
    behaviors.push(behavior("item-effects", `Forge: ${effectSourceName || "Item"} Effects`, "applyActiveEffect", {
      effects: [...new Set(effectUuids.map(String).filter(Boolean))]
    }));
    assumptions.push(`Uses Active Effects from ${effectSourceName || "the selected world item"}; Foundry applies them on entry and removes them on exit.`);
  } else if (wantsEffects) {
    warnings.push("The request mentions an effect or aura, but no world item with Active Effects was selected.");
  }

  if (!behaviors.length) {
    throw new Error("No supported native Region behavior was recognized. Try difficult terrain, movement cost, darkness, weather suppression, pausing, scrolling text, or a selected item's Active Effects.");
  }

  return {
    schemaVersion: SCENE_REGION_SCHEMA_VERSION,
    request: text,
    behaviors,
    assumptions,
    warnings
  };
}

function validateSceneRegionPlan(plan) {
  if (!plan || typeof plan !== "object") throw new Error("A Scene Region plan is required.");
  if (plan.schemaVersion !== SCENE_REGION_SCHEMA_VERSION) throw new Error(`Unsupported Scene Region schema: ${plan.schemaVersion}.`);
  if (!Array.isArray(plan.behaviors) || !plan.behaviors.length) throw new Error("The Scene Region plan has no behaviors.");
  const keys = new Set();
  for (const entry of plan.behaviors) {
    if (!SAFE_BEHAVIOR_TYPES.includes(entry?.type)) throw new Error(`Unsupported Scene Region behavior type: ${entry?.type ?? "missing"}.`);
    if (!entry.key || keys.has(entry.key)) throw new Error(`Scene Region behavior keys must be unique: ${entry?.key ?? "missing"}.`);
    if (!entry.system || typeof entry.system !== "object" || Array.isArray(entry.system)) throw new Error(`Scene Region behavior ${entry.key} has invalid system data.`);
    keys.add(entry.key);
  }
  return plan;
}

function selectedRegionDocuments(canvasState = globalThis.canvas) {
  const controlled = Array.from(canvasState?.regions?.controlled ?? []);
  return controlled.map(entry => entry?.document ?? entry).filter(entry => entry?.documentName === "Region" || entry?.constructor?.name === "RegionDocument");
}

function forgeOwnedKey(entry) {
  return entry?.flags?.[MODULE_ID]?.[SCENE_REGION_FLAG]?.key
    ?? entry?._source?.flags?.[MODULE_ID]?.[SCENE_REGION_FLAG]?.key
    ?? entry?.getFlag?.(MODULE_ID, `${SCENE_REGION_FLAG}.key`)
    ?? "";
}

function regionBehaviorData(entry) {
  return {
    name: entry.name,
    type: entry.type,
    disabled: false,
    system: structuredClone(entry.system),
    flags: {
      [MODULE_ID]: {
        [SCENE_REGION_FLAG]: {
          schemaVersion: SCENE_REGION_SCHEMA_VERSION,
          key: entry.key
        }
      }
    }
  };
}

function buildRegionBehaviorOperations(existingBehaviors, plan, { replaceOwned = true } = {}) {
  validateSceneRegionPlan(plan);
  const existing = Array.from(existingBehaviors ?? []);
  const ownedByKey = new Map();
  for (const entry of existing) {
    const key = forgeOwnedKey(entry);
    if (!key) continue;
    if (!ownedByKey.has(key)) ownedByKey.set(key, []);
    ownedByKey.get(key).push(entry);
  }

  const creates = [];
  const updates = [];
  const retainedIds = new Set();
  for (const planned of plan.behaviors) {
    const matches = ownedByKey.get(planned.key) ?? [];
    const match = matches.find(entry => entry.type === planned.type);
    const data = regionBehaviorData(planned);
    if (match) {
      updates.push({ _id: match.id ?? match._id, ...data });
      retainedIds.add(match.id ?? match._id);
    } else {
      creates.push(data);
    }
  }

  const desiredKeys = new Set(plan.behaviors.map(entry => entry.key));
  const deletes = replaceOwned
    ? existing.filter(entry => {
      const key = forgeOwnedKey(entry);
      const id = entry.id ?? entry._id;
      return key && (!desiredKeys.has(key) || !retainedIds.has(id));
    }).map(entry => entry.id ?? entry._id).filter(Boolean)
    : [];
  return { creates, updates, deletes };
}

function movementActionsFromConfig(config = globalThis.CONFIG) {
  return Object.entries(config?.Token?.movement?.actions ?? {}).filter(([, action]) => {
    return action?.terrainAction === undefined && action?.deriveTerrainDifficulty === undefined;
  }).map(([key]) => key);
}

async function validateRuntimePlan(region, plan, {
  fromUuid = globalThis.foundry?.utils?.fromUuid,
  RegionBehaviorClass = globalThis.foundry?.documents?.RegionBehavior
} = {}) {
  validateSceneRegionPlan(plan);
  if (!region || typeof region.createEmbeddedDocuments !== "function") throw new Error("Select one Scene Region before applying behaviors.");
  for (const entry of plan.behaviors) {
    if (!globalThis.CONFIG?.RegionBehavior?.dataModels?.[entry.type]) throw new Error(`Foundry has not registered Region behavior type ${entry.type}.`);
    if (entry.type === "applyActiveEffect") {
      for (const uuid of entry.system.effects) {
        const effect = await fromUuid?.(uuid);
        if (effect?.documentName !== "ActiveEffect") throw new Error(`Active Effect reference is unavailable: ${uuid}.`);
      }
    }
    if (RegionBehaviorClass) {
      const candidate = new RegionBehaviorClass(regionBehaviorData(entry), { parent: region });
      candidate.validate({ strict: true });
    }
  }
  return plan;
}

async function applySceneRegionPlan(region, plan, { replaceOwned = true, runtimeValidator = validateRuntimePlan } = {}) {
  await runtimeValidator(region, plan);
  const existing = Array.from(region.behaviors ?? []);
  const operations = buildRegionBehaviorOperations(existing, plan, { replaceOwned });
  const ownedSnapshot = existing.filter(entry => forgeOwnedKey(entry)).map(entry => entry.toObject?.() ?? structuredClone(entry));
  try {
    const created = operations.creates.length
      ? await region.createEmbeddedDocuments("RegionBehavior", operations.creates)
      : [];
    const updated = operations.updates.length
      ? await region.updateEmbeddedDocuments("RegionBehavior", operations.updates)
      : [];
    const deleted = operations.deletes.length
      ? await region.deleteEmbeddedDocuments("RegionBehavior", operations.deletes)
      : [];
    return { region, created, updated, deleted, operations };
  } catch (error) {
    try {
      const currentOwnedIds = Array.from(region.behaviors ?? []).filter(entry => forgeOwnedKey(entry)).map(entry => entry.id).filter(Boolean);
      if (currentOwnedIds.length) await region.deleteEmbeddedDocuments("RegionBehavior", currentOwnedIds);
      if (ownedSnapshot.length) await region.createEmbeddedDocuments("RegionBehavior", ownedSnapshot, { keepId: true });
    } catch (rollbackError) {
      console.error(`${MODULE_ID} could not fully roll back Scene Region changes.`, rollbackError);
    }
    throw error;
  }
}

function effectSourceItems(gameState = globalThis.game) {
  return Array.from(gameState?.items ?? []).map(item => ({
    id: item.id,
    name: item.name,
    effects: Array.from(item.effects ?? []).filter(effect => !effect.disabled).map(effect => ({ uuid: effect.uuid, name: effect.name }))
  })).filter(item => item.effects.length).sort((a, b) => a.name.localeCompare(b.name));
}

function planPreviewHTML(region, plan, effectSourceName = "") {
  const behaviorRows = plan.behaviors.map(entry => `<li><strong>${escapeHTML(entry.name)}</strong><code>${escapeHTML(entry.type)}</code></li>`).join("");
  const warnings = plan.warnings.length ? `<div class="dm_forge-region-notes" data-state="warning"><strong>Warnings</strong>${plan.warnings.map(note => `<p>${escapeHTML(note)}</p>`).join("")}</div>` : "";
  const assumptions = plan.assumptions.length ? `<div class="dm_forge-region-notes"><strong>Assumptions</strong>${plan.assumptions.map(note => `<p>${escapeHTML(note)}</p>`).join("")}</div>` : "";
  const source = effectSourceName ? `<p><strong>Effect source item:</strong> ${escapeHTML(effectSourceName)}</p>` : "";
  return `<section class="dm_forge-region-preview"><p><strong>Region:</strong> ${escapeHTML(region.name)}</p>${source}<ul>${behaviorRows}</ul>${warnings}${assumptions}</section>`;
}

function dialogRoot(dialog) {
  return dialog?.element?.[0] ?? dialog?.element ?? null;
}

function setRegionStatus(dialog, state, message) {
  const output = dialogRoot(dialog)?.querySelector?.("[data-region-status]");
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
}

function renderRegionPreview(dialog, region, plan, effectSourceName) {
  const output = dialogRoot(dialog)?.querySelector?.("[data-region-preview]");
  if (!output) return;
  output.hidden = false;
  output.innerHTML = planPreviewHTML(region, plan, effectSourceName);
}

function readRegionForm(form) {
  const request = form.elements.namedItem("regionRequest")?.value?.trim() ?? "";
  const effectItemId = form.elements.namedItem("effectItemId")?.value ?? "";
  const item = effectItemId ? game.items.get(effectItemId) : null;
  const effectUuids = item ? Array.from(item.effects ?? []).filter(effect => !effect.disabled).map(effect => effect.uuid) : [];
  return {
    request,
    item,
    effectUuids,
    replaceOwned: form.elements.namedItem("replaceOwned")?.checked === true,
    approved: form.elements.namedItem("approveRegion")?.checked === true
  };
}

async function compileDialogPlan(dialog, form) {
  const regions = selectedRegionDocuments();
  if (regions.length !== 1) throw new Error(`Select exactly one Scene Region. Currently selected: ${regions.length}.`);
  const input = readRegionForm(form);
  const plan = compileSceneRegionRequest(input.request, {
    effectUuids: input.effectUuids,
    effectSourceName: input.item?.name ?? "",
    movementActions: movementActionsFromConfig()
  });
  await validateRuntimePlan(regions[0], plan);
  dialog._dmfSceneRegionPlan = plan;
  dialog._dmfSceneRegionId = regions[0].id;
  renderRegionPreview(dialog, regions[0], plan, input.item?.name ?? "");
  return { region: regions[0], plan, input };
}

function regionForgeContent(region, items) {
  const options = items.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)} (${item.effects.length} effect${item.effects.length === 1 ? "" : "s"})</option>`).join("");
  return `<form class="dm_forge-region-shell standard-form" autocomplete="off">
    <div class="dm_forge-region-selection"><span>Selected Region</span><strong>${escapeHTML(region.name)}</strong></div>
    <div class="form-group stacked"><label>Region request</label><textarea name="regionRequest" rows="6" aria-label="Scene Region request" placeholder="Make this magical difficult terrain, suppress weather, and display &quot;The dream shifts&quot; once when a token enters."></textarea></div>
    <div class="form-group"><label>World item Active Effects</label><div class="form-fields"><select name="effectItemId" aria-label="Region effect source item"><option value="">None</option>${options}</select></div><p class="notes">Select a generated world item only when the request should apply its Active Effects while tokens remain inside the Region.</p></div>
    <div class="form-group"><label>Replace prior Forge behaviors</label><div class="form-fields"><label class="checkbox"><input type="checkbox" name="replaceOwned" checked></label></div><p class="notes">Only behaviors previously created by Dungeon Master's Forge are reconciled. Other Region behaviors are preserved.</p></div>
    <div class="dm_forge-region-preview" data-region-preview hidden></div>
    <label class="dm_forge-region-approval"><input type="checkbox" name="approveRegion"> I reviewed this plan and approve changes to the selected Region.</label>
    <output class="dm_forge-settings-status" data-region-status data-state="idle" aria-live="polite">Preview the request before applying it.</output>
  </form>`;
}

async function openSceneRegionForge() {
  if (!game.user?.isGM) {
    ui.notifications.error("Only a GM can use Scene Region Forge.");
    return null;
  }
  if (game.settings.get(MODULE_ID, "enableSceneRegionForge") !== true) {
    ui.notifications.warn("Enable Experimental Scene Region Forge in Forge Settings first.");
    return null;
  }
  const regions = selectedRegionDocuments();
  if (regions.length !== 1) {
    ui.notifications.warn(`Select exactly one Scene Region before opening Scene Region Forge. Currently selected: ${regions.length}.`);
    return null;
  }

  const dialog = new foundry.applications.api.DialogV2({
    classes: ["dungeon-masters-forge", "dungeon-masters-forge-region"],
    window: { title: "Dungeon Master's Forge: Scene Region", icon: "fa-solid fa-draw-polygon", resizable: true },
    position: { width: 720, height: 700 },
    form: { closeOnSubmit: false },
    content: regionForgeContent(regions[0], effectSourceItems()),
    buttons: [
      {
        action: "preview-region",
        label: "Preview",
        icon: "fa-solid fa-wand-magic-sparkles",
        type: "button",
        callback: async (_event, button, instance) => {
          try {
            setRegionStatus(instance, "working", "Validating native Region behaviors...");
            const { plan } = await compileDialogPlan(instance, button.form);
            setRegionStatus(instance, plan.warnings.length ? "warning" : "success", `Validated ${plan.behaviors.length} native behavior${plan.behaviors.length === 1 ? "" : "s"}.`);
          } catch (error) {
            setRegionStatus(instance, "error", error.message ?? String(error));
          }
        }
      },
      {
        action: "apply-region",
        label: "Apply to Region",
        icon: "fa-solid fa-check",
        type: "button",
        default: true,
        callback: async (_event, button, instance) => {
          try {
            const compiled = await compileDialogPlan(instance, button.form);
            if (!compiled.input.approved) throw new Error("Review the plan and approve the Region changes before applying them.");
            setRegionStatus(instance, "working", "Applying native Region behaviors...");
            const result = await applySceneRegionPlan(compiled.region, compiled.plan, { replaceOwned: compiled.input.replaceOwned });
            setRegionStatus(instance, "success", `Applied ${result.created.length} new and ${result.updated.length} updated behavior${result.created.length + result.updated.length === 1 ? "" : "s"}; removed ${result.deleted.length} superseded Forge behavior${result.deleted.length === 1 ? "" : "s"}.`);
            ui.notifications.info("Dungeon Master's Forge updated the selected Scene Region.");
          } catch (error) {
            setRegionStatus(instance, "error", error.message ?? String(error));
          }
        }
      }
    ]
  });
  dialog.render({ force: true });
  return dialog;
}

export {
  SAFE_BEHAVIOR_TYPES,
  SCENE_REGION_SCHEMA_VERSION,
  applySceneRegionPlan,
  buildRegionBehaviorOperations,
  compileSceneRegionRequest,
  effectSourceItems,
  movementActionsFromConfig,
  openSceneRegionForge,
  selectedRegionDocuments,
  validateRuntimePlan,
  validateSceneRegionPlan
};
