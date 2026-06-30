import { analyzeRequestIntent } from "../request-intent.mjs";

function titleFromRequest(request) {
  const named = request.match(/^\s*Item name\s*:\s*(.+)$/im)?.[1]?.trim();
  if (named) return named.slice(0, 120);
  const firstLine = request.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? "Mock Ember Blade";
  return /^(?:make|create)\b/i.test(firstLine) ? "Mock Ember Blade" : firstLine.slice(0, 120);
}

async function compileWithMock(envelope) {
  const intent = analyzeRequestIntent(envelope.request);
  const kind = envelope.context.supportedKinds.includes("weaponExtraDamage")
    ? "weaponExtraDamage"
    : envelope.context.supportedKinds[0];
  if (kind !== "weaponExtraDamage") {
    return {
      specs: intent.chunks.map((chunk, index) => ({
        kind,
        name: intent.explicitNames[index] || titleFromRequest(chunk) || `Mock Forge Item ${index + 1}`,
        description: chunk
      })),
      assumptions: ["Mock mode returned a transport fixture for the first supported pattern."],
      warnings: ["Mock mode does not interpret item mechanics."],
      deferred: []
    };
  }

  const specs = intent.chunks.map((chunk, index) => {
    const name = intent.explicitNames[index] || titleFromRequest(chunk) || `Mock Ember Blade ${index + 1}`;
    return {
      kind,
      name,
      img: "icons/weapons/swords/sword-guard-flanged.webp",
      description: chunk,
      rarity: "uncommon",
      attunement: "",
      weaponType: "martialM",
      baseItem: "longsword",
      properties: ["mgc", "ver"],
      damage: {
        base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] },
        versatile: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] }
      },
      magicalBonus: "",
      range: { value: 5, long: null, reach: null, units: "ft" },
      extraDamageParts: [{ number: 1, denomination: 4, bonus: "", types: ["fire"] }],
      attackName: `Attack with ${name}`
    };
  });

  return {
    specs,
    assumptions: ["Mock mode produced a known-good longsword with 1d4 extra fire damage."],
    warnings: ["Mock mode verifies transport and review behavior; it is not an AI interpretation."],
    deferred: []
  };
}

export { compileWithMock };
