import { test } from "node:test";
import assert from "node:assert/strict";

// The built package imports in Node as it does in a bundler: every relative import names its file.
test("the built package imports in Node", async () => {
  const kit = await import("../../dist/index.js");
  assert.equal(typeof kit.startDemo, "function");
  assert.equal(typeof kit.recordingKeyOf, "function");
  const { demoBuild } = await import("../../dist/vite.js");
  assert.equal(demoBuild().base, "./");
});
