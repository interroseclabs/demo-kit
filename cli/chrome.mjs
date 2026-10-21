// A headless Chrome, driven over the DevTools protocol with Node's own WebSocket: what `visit`
// and `check` open pages in. CHROME names the browser; otherwise the usual places are tried.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PLACES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of PLACES) if (existsSync(p)) return p;
  for (const n of NAMES) {
    const r = spawnSync("which", [n], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error("no Chrome found: set CHROME to a Chrome or Chromium binary");
}

// launch starts a headless Chrome and connects to its first page.
export async function launch({ width = 1440, height = 900 } = {}) {
  const work = mkdtempSync(join(tmpdir(), "demo-kit-chrome-"));
  const port = 9300 + Math.floor(Math.random() * 600);
  const args = [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(work, "profile")}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    `--window-size=${width},${height}`,
    "about:blank",
  ];
  if (process.getuid?.() === 0) args.unshift("--no-sandbox");
  const chrome = spawn(findChrome(), args, { stdio: "ignore" });
  let targets = [];
  for (let i = 0; i < 150 && !targets.some((t) => t.type === "page"); i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch {
      await sleep(100);
    }
  }
  const target = targets.find((t) => t.type === "page");
  if (!target) {
    chrome.kill();
    throw new Error("Chrome started but offered no page to drive");
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r, { once: true });
    ws.addEventListener("error", j, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method) for (const l of listeners) l(m);
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  // In-flight requests, for waiting until a page has read all it reads as it opens.
  const inflight = new Set();
  listeners.add((m) => {
    if (m.method === "Network.requestWillBeSent") inflight.add(m.params.requestId);
    else if (m.method === "Network.loadingFinished" || m.method === "Network.loadingFailed") inflight.delete(m.params.requestId);
  });

  return {
    work,
    send,
    evaluate,
    on: (l) => listeners.add(l),
    inflight,
    async navigate(url) {
      await send("Page.navigate", { url });
    },
    async resize(w, h, mobile = false) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
    },
    async close() {
      ws.close();
      const exited = new Promise((r) => chrome.once("exit", r));
      chrome.kill();
      await Promise.race([exited, sleep(3000)]);
      rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

// settle waits until the page's text has stopped changing and nothing is being read, or ms pass.
export async function settle(page, { quiet = 600, max = 15000 } = {}) {
  const until = Date.now() + max;
  let last = null;
  let since = Date.now();
  while (Date.now() < until) {
    await sleep(150);
    const text = (await page.evaluate("document.body?.innerText ?? ''").catch(() => "")) ?? "";
    if (text !== last || page.inflight.size > 0) {
      last = text;
      since = Date.now();
    } else if (Date.now() - since >= quiet) return;
  }
}

// readList reads a list file: one entry a line, blank lines and # comments skipped.
export function listOf(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}
