#!/usr/bin/env node
// The kit end to end, on the sample SPA: its API, the recorder in front of it, Vite's dev server
// pointed at the recorder, every route visited, the crawl's paths fetched, the demo built and
// packaged, the page checked as a viewer opens it, and its tour filmed for a website. It fails
// where any step does.
//
//   npm run e2e          (CHROME names the browser; KEEP=1 keeps test/e2e/out, the film in out/film)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

import { DEMO_ORIGIN, recordingKey, recordingKeyOf } from "../../dist/replay.js";

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

// filmed films the page's tour, quickly, and holds what it writes to the tour: a video of the
// whole tour and of each chapter in every encode, timings.json naming every step in order, the
// reference module with nothing left to fill in, and the 16:9 film.
function filmed(page, dir) {
  run("film", ["film", page, "--out", dir, "--quick", "--wide", "--name", "harbor"]);
  const probe = (f) => {
    const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height:format=duration", "-of", "json", f], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`film wrote no video at ${f}`);
    const j = JSON.parse(r.stdout);
    return { width: j.streams[0].width, height: j.streams[0].height, duration: +j.format.duration };
  };
  const site = join(dir, "website");
  const timings = JSON.parse(readFileSync(join(site, "timings.json"), "utf8"));
  const names = ["harbor-walkthrough", "harbor-chapter-1-the-overview", "harbor-chapter-2-find-the-late-ones", "harbor-chapter-3-the-paperwork"];
  if (JSON.stringify(Object.keys(timings.videos)) !== JSON.stringify(names)) throw new Error(`film cut ${Object.keys(timings.videos).join(", ")}`);
  for (const name of names) {
    const v = timings.videos[name];
    for (const [suffix, w, h] of [["-1920x960.mp4", 1920, 960], ["-1280x640.mp4", 1280, 640], ["-1920x960.webm", 1920, 960]]) {
      const got = probe(join(site, name + suffix));
      if (got.width !== w || got.height !== h || Math.abs(got.duration - v.duration) > 0.1) throw new Error(`${name}${suffix} is ${got.width}x${got.height}, ${got.duration}s; timings.json says ${v.duration}s`);
    }
    for (const suffix of ["-poster.jpg", ".vtt"]) if (!existsSync(join(site, name + suffix))) throw new Error(`film wrote no ${name}${suffix}`);
    if (v.steps.some((s, i) => !(s.at > s.start) || (i > 0 && !(s.start > v.steps[i - 1].start)) || s.at > v.duration)) throw new Error(`${name}'s steps are out of order: ${JSON.stringify(v.steps)}`);
  }
  const whole = timings.videos["harbor-walkthrough"];
  const ids = ["figures", "delays", "delayed-figure", "delayed-list", "shipment", "document", "reports", "preview", "preview-carrier"];
  if (JSON.stringify(whole.steps.map((s) => s.id)) !== JSON.stringify(ids)) throw new Error(`the walkthrough's steps are ${whole.steps.map((s) => s.id).join(", ")}`);
  if (whole.steps[0].label !== "Figures") throw new Error(`a step's film.label isn't its label on the module: ${whole.steps[0].label}`);
  // Reports is reached by its menu, a pass shot before its own.
  const reports = whole.steps.find((s) => s.id === "reports");
  if (!(reports.at - reports.start > 3)) throw new Error(`reports' film.via made no shot: ${JSON.stringify(reports)}`);
  const embed = readFileSync(join(site, "embed-example.html"), "utf8");
  if (/__[A-Z]+__/.test(embed) || !embed.includes('"harbor-chapter-1-the-overview"')) throw new Error("the reference module isn't filled in");
  const wide = probe(join(dir, "film", "harbor-film-1920x1080.mp4"));
  if (wide.width !== 1920 || wide.height !== 1080 || wide.duration < whole.duration) throw new Error(`the 16:9 film is ${wide.width}x${wide.height}, ${wide.duration}s`);
  console.log(`ok   film cut the tour, ${whole.duration}s, its chapters and the 16:9 film, ${wide.duration.toFixed(1)}s`);
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
    // The report preview's query, a POST that reads.
    "--read",
    "POST /api/query",
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
  filmed(join(out, "harbor-demo.html"), join(out, "film"));

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

  // So does a page missing a POST that reads, in the report preview's frame, named with its body
  // for demo-kit fetch to send.
  const carrier = JSON.stringify({ measure: "delayed", by: "carrier" });
  const carrierKey = recordingKey(new URL("/api/query", DEMO_ORIGIN), { method: "POST", body: carrier });
  const noCarrier = JSON.parse(readFileSync(recording, "utf8"));
  const raw = Object.keys(noCarrier).find((k) => recordingKeyOf(k) === carrierKey);
  if (!raw) throw new Error("the recording holds no read of the preview By carrier");
  delete noCarrier[raw];
  writeFileSync(join(out, "no-carrier.json"), JSON.stringify(noCarrier));
  run("package", ["package", "--recording", join(out, "no-carrier.json"), "--build", join(out, "dist-demo"), "--out", join(out, "no-carrier.html"), "--replace", "dana.ops@lakeside.example=demo@harbor.example"]);
  console.log("\n$ demo-kit check no-carrier.html (which must fail)");
  const carrierCheck = spawnSync(process.execPath, [kit, "check", join(out, "no-carrier.html"), "--routes", "demo/routes.txt", "--misses", join(out, "no-carrier-misses.txt")], { cwd: app, encoding: "utf8" });
  if (carrierCheck.status !== 1) throw new Error(`check passed a page missing a POST read:\n${carrierCheck.stdout}`);
  const named = readFileSync(join(out, "no-carrier-misses.txt"), "utf8").trim();
  if (named !== `${carrierKey}  [POST /api/query ${carrier}]`) throw new Error(`check didn't name the missing POST read: ${named}`);
  console.log("ok   check fails a page missing a POST that reads, and names it with its body");
  console.log("\nend to end: ok");
} catch (e) {
  failed = true;
  console.error(`\nend to end: FAIL: ${e.message}`);
} finally {
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  if (!process.env.KEEP && !failed) rmSync(out, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
