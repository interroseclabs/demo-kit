import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// The skill installs the package at its own version: a release moves every one of these together.
test("the package, the engine, the plugin and the skill name one version", () => {
  const version = JSON.parse(read("package.json")).version;
  assert.match(read("src/index.tsx"), new RegExp(`VERSION = "${version}"`));
  assert.equal(JSON.parse(read("plugin/.claude-plugin/plugin.json")).version, version);
  assert.equal(JSON.parse(read(".claude-plugin/marketplace.json")).plugins[0].version, version);
  const skill = read("plugin/skills/guided-demo/SKILL.md");
  const pins = [...skill.matchAll(/demo-kit#v(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
  assert.ok(pins.length > 0, "the skill pins the package");
  assert.deepEqual([...new Set(pins)], [version]);
  assert.match(read("README.md"), new RegExp(`demo-kit#v${version}`));
});
