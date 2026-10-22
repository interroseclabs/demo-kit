#!/usr/bin/env node
// The kit end to end, on the sample SPA: its API, the recorder in front of it, Vite's dev server
// pointed at the recorder, every route visited, the crawl's paths fetched, the demo built and
// packaged, and the page checked as a viewer opens it. It fails where any step does.
//
//   npm run e2e          (CHROME names the browser; KEEP=1 keeps test/e2e/out)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = join(root, "examples/sample-spa");
const out = join(root, "test/e2e/out");
const kit = join(root, "bin/demo-kit.mjs");
const base = 20000 + Math.floor(Math.random() * 20000);
const [API, REC, DEV] = [base, base + 1, base + 2];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const recording = join(out, "recording.json");
const children = [];

function start(name, cmd, args, opts = {}) {
  const c = spawn(cmd, args, { cwd: app, stdio: ["ignore", "pipe", "pipe"], ...opts });
  c.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  c.stderr.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  children.push(c);
  return c;
}

function run(name, args, opts = {}) {
  console.log(`\n$ demo-kit ${args.join(" ")}`);
  const r = spawnSync(process.execPath, [kit, ...args], { cwd: app, stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${name} failed (exit ${r.status})`);
}

async function up(url) {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`nothing answered at ${url}`);
}

let failed = false;
try {
  if (!existsSync(join(app, "node_modules"))) {
    const r = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: app, stdio: "inherit" });
    if (r.status !== 0) throw new Error("npm install failed in the sample SPA");
  }
  start("api", process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(API) } });
  await up(`http://127.0.0.1:${API}/`);
  const recorder = start("record", process.execPath, [
    kit,
    "record",
    "--upstream",
    `http://127.0.0.1:${API}`,
    "--recording",
    recording,
    "--listen",
    `127.0.0.1:${REC}`,
    "--header",
    "Authorization: Bearer dev-token",
  ]);
  await up(`http://127.0.0.1:${REC}/`);
  start("vite", process.execPath, [join(app, "node_modules/vite/bin/vite.js"), "--port", String(DEV), "--strictPort"], {
    env: { ...process.env, HARBOR_API: `http://127.0.0.1:${REC}` },
  });
  await up(`http://localhost:${DEV}/`);

  run("visit", ["visit", "--origin", `http://localhost:${DEV}`, "--routes", "demo/routes.txt"]);
  // The recorder saves every 2 s; the crawl reads what the visit kept.
  await sleep(2500);
  const paths = spawnSync(process.execPath, ["demo/crawl.mjs", recording], { cwd: app, encoding: "utf8" });
  if (paths.status !== 0) throw new Error(`the crawl failed: ${paths.stderr}`);
  writeFileSync(join(out, "paths.txt"), paths.stdout);
  run("fetch", ["fetch", "--paths", join(out, "paths.txt"), "--via", `http://127.0.0.1:${REC}`]);

  // The recorder refuses a change.
  const refused = await fetch(`http://127.0.0.1:${REC}/api/shipments/SHP-1001/notes`, { method: "POST", body: "{}" });
  if (refused.status !== 403) throw new Error(`the recorder let a POST through: ${refused.status}`);

  recorder.kill("SIGTERM");
  await new Promise((r) => recorder.once("exit", r));
  const kept = Object.keys(JSON.parse(readFileSync(recording, "utf8"))).length;
  console.log(`\nthe recording holds ${kept} responses`);

  const build = spawnSync(process.execPath, [join(app, "node_modules/vite/bin/vite.js"), "build", "--config", "vite.demo.config.ts", "--outDir", join(out, "dist-demo")], {
    cwd: app,
    stdio: "inherit",
  });
  if (build.status !== 0) throw new Error("the demo build failed");

  // The signed-in user's address is the one real-looking address a recording holds.
  run("package", [
    "package",
    "--recording",
    recording,
    "--build",
    join(out, "dist-demo"),
    "--out",
    join(out, "harbor-demo.html"),
    "--prospect",
    "Example Co",
    "--contact-url",
    "https://example.com/book",
    "--contact-label",
    "Book a session",
    "--replace",
    "dana.ops@lakeside.example=demo@harbor.example",
  ]);
  run("check", ["check", join(out, "harbor-demo.html"), "--routes", "demo/routes.txt", "--misses", join(out, "misses.txt")]);

  // A page missing a read fails, and names the read for demo-kit fetch.
  const short = JSON.parse(readFileSync(recording, "utf8"));
  delete short["/api/reports"];
  writeFileSync(join(out, "short.json"), JSON.stringify(short));
  run("package", ["package", "--recording", join(out, "short.json"), "--build", join(out, "dist-demo"), "--out", join(out, "short.html"), "--replace", "dana.ops@lakeside.example=demo@harbor.example"]);
  console.log("\n$ demo-kit check short.html (which must fail)");
  const shortCheck = spawnSync(process.execPath, [kit, "check", join(out, "short.html"), "--routes", "demo/routes.txt", "--misses", join(out, "short-misses.txt")], { cwd: app, encoding: "utf8" });
  if (shortCheck.status !== 1) throw new Error(`check passed a page missing a read:\n${shortCheck.stdout}`);
  if (readFileSync(join(out, "short-misses.txt"), "utf8").trim() !== "/api/reports  [/api/reports]") throw new Error("check didn't name the missing read");
  console.log("ok   check fails a page missing a read, and names it");
  console.log("\nend to end: ok");
} catch (e) {
  failed = true;
  console.error(`\nend to end: FAIL: ${e.message}`);
} finally {
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  if (!process.env.KEEP && !failed) rmSync(out, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
