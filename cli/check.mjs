// demo-kit check: opens a packaged demo the way its viewer does, from a file, in Chrome, and fails
// on anything a viewer would trip on. It opens each route listed, walks the guided tour from its
// welcome to its end screen by its own Next, explores freely, and opens the tour on a phone's
// window. It fails on any read the recording lacks, any page error, any request to the network,
// and any step whose element or click the page doesn't show.
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { MISSING } from "../dist/replay.js";
import { launch, listOf, settle } from "./chrome.mjs";

const OWN = /^(file|data|blob|about|chrome|chrome-extension|devtools):/i;

export async function check({ page: file, routes, width = 1440, height = 900, misses: missesOut, log = console.log }) {
  const page = await launch({ width, height });
  const misses = new Map();
  const errors = [];
  const network = new Set();
  page.on((m) => {
    if (m.method === "Runtime.consoleAPICalled") {
      const text = m.params.args.map((a) => a.value ?? a.description).join(" ");
      if (text.startsWith(MISSING)) {
        const line = text.slice(MISSING.length);
        misses.set(line.replace(/\s+\[.*\]$/, ""), line);
      } else if (m.params.type === "error") errors.push(text);
    }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Network.requestWillBeSent" && !OWN.test(m.params.request.url)) network.add(m.params.request.url);
  });

  let failed = 0;
  const check = (what, ok, detail = "") => {
    if (!ok) failed++;
    log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
    return ok;
  };
  const waitFor = async (expression, ms = 10000) => {
    const until = Date.now() + ms;
    for (;;) {
      const v = await page.evaluate(expression).catch(() => null);
      if (v || Date.now() > until) return v;
      await sleep(100);
    }
  };
  // The tour is drawn in the shadow root of .gd-ui; T(selector) is a query in it.
  const T = (selector) => `(document.querySelector(".gd-ui")?.shadowRoot ?? document).querySelector(${JSON.stringify(selector)})`;
  const TA = (selector) => `[...(document.querySelector(".gd-ui")?.shadowRoot ?? document).querySelectorAll(${JSON.stringify(selector)})]`;
  const clickOn = (selector) => page.evaluate(`(() => { const e = ${T(selector)}; e?.click(); return Boolean(e); })()`);
  const url = `file://${resolve(file)}`;

  try {
    await page.navigate(url);
    const started = await waitFor(`window.__demoKit ? "ok" : document.querySelector('[data-gd="failed"]')?.textContent`, 20000);
    if (!check("the page starts from a file", started === "ok", started && started !== "ok" ? started : "")) return finish();
    const kit = await page.evaluate("window.__demoKit");
    const steps = kit.steps;
    check("the welcome screen opens", Boolean(await waitFor(T('[data-gd="welcome"]'))), `${steps.length} steps in ${kit.chapters.length} chapters`);
    const config = await page.evaluate(`(() => { try { return JSON.parse(document.getElementById("demo-config")?.textContent ?? "{}"); } catch { return {}; } })()`);
    log(`     prepared for ${config.prospect ?? "nobody in particular"}; call to action: ${config.contact ? `${config.contact.label} → ${config.contact.href}` : "none"}`);
    if (config.contact) check("the bar carries the call to action", Boolean(await page.evaluate(T('[data-gd="bar"] [data-gd="contact"]'))));
    await settle(page);

    // Each route, as a viewer exploring would open it.
    for (const route of routes ? listOf(readFileSync(routes, "utf8")) : []) {
      const before = misses.size;
      const errs = errors.length;
      await page.evaluate(`location.hash = ${JSON.stringify(route.startsWith("/") ? route : `/${route}`)}`);
      await settle(page);
      check(`opens ${route}`, misses.size === before && errors.length === errs, newer(misses, before));
    }

    // The tour, from its welcome, by its own Next: a click step's Next takes its click.
    await page.evaluate(`localStorage.clear(); location.hash = "#/"`);
    await page.navigate(url);
    await waitFor(T('[data-gd="start"]'), 20000);
    await settle(page);
    await clickOn('[data-gd="start"]');
    const walked = [];
    for (let i = 0; i < steps.length + 2; i++) {
      const at = await waitFor(`(() => { const c = ${T('[data-gd="card"]')}; return c ? { id: c.dataset.gdStep, anchor: c.dataset.gdAnchor, click: c.dataset.gdClick, title: c.querySelector("h2")?.textContent } : null; })()`, 15000);
      if (!at) {
        check(`tour step ${i + 1} shows its card`, false, "no card came up");
        break;
      }
      const before = misses.size;
      const errs = errors.length;
      await settle(page, { quiet: 400 });
      walked.push(at.id);
      const problems = [
        at.anchor === "missing" && "its element isn't on the page",
        at.click === "missing" && "what it asks the viewer to click isn't on the page",
        misses.size > before && newer(misses, before),
        errors.length > errs && errors.slice(errs).join("; "),
      ].filter(Boolean);
      check(`tour step ${i + 1}/${steps.length} ${at.id}, ${at.title}`, problems.length === 0, problems.join("; "));
      await clickOn('[data-gd="next"]');
      const moved = await waitFor(`(() => { const c = ${T('[data-gd="card"]')}; return ${T('[data-gd="end"]')} ? "end" : c && c.dataset.gdStep !== ${JSON.stringify(at.id)} ? "next" : null; })()`, 15000);
      if (moved === "end") break;
      if (!moved) {
        check(`tour step ${i + 1} goes on by Next`, false, "the card stayed");
        break;
      }
    }
    const want = steps.map((s) => s.id);
    check("the tour walks every step in order", JSON.stringify(walked) === JSON.stringify(want), walked.length === want.length ? "" : `walked ${walked.length} of ${want.length}`);
    check("the tour ends on its end screen", Boolean(await waitFor(T('[data-gd="end"]'), 5000)));

    // Exploring freely: the end screen's Explore, the way back into the tour, and a page's hotspots.
    await page.evaluate(`${TA('[data-gd="end"] button')}.find((b) => b.textContent.includes("Explore"))?.click()`);
    check("Explore freely leaves a way back into the tour", Boolean(await waitFor(T('[data-gd="resume-tour"]'), 5000)));
    const spot = steps.find((s) => s.anchor && !s.needs);
    if (spot) {
      await page.evaluate(`location.hash = ${JSON.stringify(spot.to)}`);
      await settle(page);
      check(`exploring ${spot.to} shows the tour's stops as hotspots`, Boolean(await waitFor(T('[data-gd="hotspot"]'), 8000)));
    }

    // A phone's window: the card sits across the foot of the screen.
    await page.resize(390, 844, true);
    await page.evaluate(`localStorage.clear()`);
    await page.navigate(url);
    await waitFor(T('[data-gd="start"]'), 20000);
    await clickOn('[data-gd="start"]');
    const fits = await waitFor(
      `(() => { const c = ${T('[data-gd="card"]')}; if (!c) return null; const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.top >= 44 ? "fits" : "off " + JSON.stringify(r); })()`,
      15000,
    );
    check("the tour fits a phone's window", fits === "fits", fits && fits !== "fits" ? fits : "");
  } finally {
    await page.close();
  }
  return finish();

  function finish() {
    for (const n of network) check("loads nothing from the network", false, n);
    if (network.size === 0) check("loads nothing from the network", true);
    for (const [, line] of misses) log(`not in the recording: ${line}`);
    for (const e of errors) log(`page error: ${e}`);
    if (missesOut) writeFileSync(missesOut, [...misses.values()].join("\n") + (misses.size ? "\n" : ""));
    const size = statSync(file).size;
    log(`${file}: ${(size / 1e6).toFixed(1)} MB${size > 20e6 ? ", too big for most email" : ""}`);
    const ok = failed === 0 && misses.size === 0 && errors.length === 0;
    log(ok ? "the demo is ready to send" : `not ready: ${failed} checks failed, ${misses.size} reads missing, ${errors.length} page errors`);
    return { ok, failed, misses: [...misses.values()], errors };
  }
}

function newer(misses, before) {
  return [...misses.keys()].slice(before).map((k) => `not recorded: ${k}`).join("; ");
}
