import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("stable packaging copies reviewed runtime files instead of repository fixtures", async () => {
  const script = await readFile(new URL("../build-stable-package.ps1", import.meta.url), "utf8");
  const testerScript = await readFile(new URL("../../testing/build-tester-package.ps1", import.meta.url), "utf8");
  const entry = await readFile(new URL("../scripts/dungeon-masters-forge.js", import.meta.url), "utf8");
  const stableManifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
  const testerManifest = JSON.parse(await readFile(new URL("../../testing/module.json", import.meta.url), "utf8"));

  assert.match(script, /README\.md/);
  assert.match(script, /CHANGELOG\.md/);
  assert.match(script, /ROADMAP\.md/);
  assert.match(script, /scripts/);
  assert.match(script, /templates/);
  assert.match(script, /scripts\/verification-harness\.js/);
  assert.match(script, /Remove-Item -LiteralPath \$packagePath/);
  assert.match(testerScript, /module\/\$relativePath/);
  assert.match(testerScript, /LICENSE/);
  assert.doesNotMatch(testerScript, /Join-Path \$repoRoot "module\/\*"/);
  assert.equal(stableManifest.license, "LICENSE");
  assert.equal(testerManifest.license, "LICENSE");
  assert.match(await readFile(new URL("../LICENSE", import.meta.url), "utf8"), /MIT License/);
  assert.match(entry, /import\("\.\/verification-harness\.js"\)/);
  assert.doesNotMatch(entry, /from "\.\/verification-harness\.js"/);
  assert.equal(testerManifest.flags?.["dungeon-masters-forge"]?.verificationHarness, true);
  assert.doesNotMatch(script, /Join-Path \$PSScriptRoot "\*"/);
  assert.doesNotMatch(script, /Join-Path \$repoRoot "module\/\*"/);
});

test("stable runtime sources contain no bundled secret markers or media assets", async () => {
  const root = new URL("../", import.meta.url);
  const roots = ["module.json", "README.md", "CHANGELOG.md", "ROADMAP.md", "docs", "scripts", "styles", "templates"];
  const files = [];

  async function collect(relativePath) {
    const absolutePath = new URL(relativePath, root);
    const entry = await (await import("node:fs/promises")).stat(absolutePath);
    if (entry.isFile()) {
      files.push(absolutePath);
      return;
    }
    for (const child of await readdir(absolutePath, { withFileTypes: true })) {
      await collect(join(relativePath, child.name));
    }
  }

  for (const relativePath of roots) await collect(relativePath);

  for (const file of files) {
    assert.doesNotMatch(file.pathname, /\.(?:png|jpe?g|gif|webp|mp3|wav|ogg|mp4)$/i);
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /sk-[A-Za-z0-9]{20,}|BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|OPENAI_API_KEY\s*=\s*[^r]|DMF_CLIENT_TOKEN\s*=\s*[^e]/i);
  }
});
