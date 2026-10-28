// demo-kit film: films a packaged demo's guided tour as video for a website. It opens the page in
// headless Chrome, hides the tour, and walks it as the tour does, entering each step by the tour's
// own code. Each step is a shot: the camera moves over the app to the step's element, the cursor
// goes to it, a spotlight and a ring light it, the step's card comes up beside it, and the cursor
// takes its click, which the film then makes, so the next step starts where the app took it. A
// shot is captured frame by frame into ffmpeg, then the shots are cut, with dissolves, into a 2:1
// video of the whole tour and one of each chapter, with timings.json and a reference module; with
// wide, into a 16:9 film with title, chapter and closing cards too.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

import { launch, settle } from "./chrome.mjs";
import { needFfmpeg, encoder, website, wide as cutWide, WINDOW, TRACK } from "./film-cut.mjs";
import { frames, H, planner, shotsOf, state, W } from "./film-plan.mjs";

const TOKENS = ["accent", "accent-fg", "bg", "surface", "fg", "muted-fg", "dim"];
const TYPES = { ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const KIT = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// dataURL is a file as a data: URL, of a type film knows.
function dataURL(file, what) {
  const type = TYPES[extname(file).toLowerCase()];
  if (!type || (what === "font") !== type.startsWith("font/")) throw new Error(`--${what} ${file}: not a ${what === "font" ? "WOFF2, WOFF, TTF or OTF" : "SVG, PNG, JPEG or WebP"} file`);
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
}

// colorsOf reads --color token=value options into the tokens they set.
function colorsOf(list) {
  const out = {};
  for (const c of list) {
    const [token, ...value] = c.split("=");
    if (!TOKENS.includes(token) || !value.join("=").trim()) throw new Error(`--color ${c}: give token=value, the token one of ${TOKENS.join(", ")}`);
    out[token] = value.join("=").trim();
  }
  return out;
}

export async function film({
  page: file,
  out,
  name,
  quick = false,
  stills = false,
  wide = false,
  pageHeight = 900,
  colors = [],
  font,
  logo,
  product,
  tagline,
  closing,
  heading,
  lede,
  contactUrl,
  contactLabel,
  log = console.log,
}) {
  if (!stills) needFfmpeg();
  if (contactUrl && !/^(https:|mailto:)/i.test(contactUrl)) throw new Error("--contact-url must be an https: or mailto: link");
  if (!(pageHeight >= H)) throw new Error(`--page-height must be at least ${H}`);
  const fps = quick ? 30 : 60;
  const scale = quick || stills ? 1 : 2;
  const canvas = Math.round(pageHeight);
  name ??= basename(file, extname(file));
  const work = join(out, "work");
  rmSync(join(work, "shots"), { recursive: true, force: true });
  for (const d of [join(work, "shots"), join(work, "masters"), join(work, "cards"), stills ? join(out, "stills") : join(out, "website")]) mkdirSync(d, { recursive: true });
  const look = { colors: colorsOf(colors), font: font ? dataURL(font, "font") : null, logo: logo ? dataURL(logo, "logo") : null };

  // The page is laid out canvas px tall, as on a laptop; the film is its top W×H, which the
  // camera's moves fill.
  const page = await launch({ width: W, height: canvas });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  try {
    await page.send("Emulation.setDeviceMetricsOverride", { width: W, height: canvas, deviceScaleFactor: scale, mobile: false });
    // The app as still as it can be: what moves in a shot is the film's.
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await page.navigate(pathToFileURL(resolve(file)).href);
    let started = null;
    for (let i = 0; i < 200 && !started; i++) {
      started = await page.evaluate(`window.__demoKit ? "ok" : document.querySelector('[data-gd="failed"]')?.textContent`).catch(() => null);
      if (!started) await sleep(100);
    }
    if (started !== "ok") throw new Error(`${file} didn't start${started ? `: ${started}` : ""}`);
    const made = await page.evaluate(`({ version: window.__demoKit.version, film: Boolean(window.__demoKit.film) })`);
    if (!made.film) throw new Error(`${file} was built with demo-kit ${made.version}, whose tour can't be filmed: build and package it again with this one, ${KIT}`);
    const { chapters, text } = await page.evaluate(`({ chapters: window.__demoKit.film.chapters, text: window.__demoKit.film.text })`);
    const config = await page.evaluate(`(() => { try { return JSON.parse(document.getElementById("demo-config")?.textContent ?? "{}"); } catch { return {}; } })()`);
    await settle(page);

    const copy = {
      product: product ?? text.title,
      tagline: tagline ?? text.welcome.heading,
      closing: closing ?? "See it on your own data.",
      heading: heading ?? text.welcome.heading,
      lede: lede ?? text.welcome.body,
      contact: contactUrl ? { label: contactLabel ?? config.contact?.label ?? "Talk to us", href: contactUrl } : config.contact ? { ...config.contact, label: contactLabel ?? config.contact.label } : null,
    };
    const layer = readFileSync(new URL("./film-layer.js", import.meta.url), "utf8");
    const drawn = await page.evaluate(
      `(${layer})(${JSON.stringify({ W, H, colors: look.colors, font: look.font, logo: look.logo, copy, chapters: chapters.map((c) => ({ title: c.title, blurb: c.blurb })), window: WINDOW, track: TRACK })})`,
    );
    await page.evaluate("document.fonts.ready.then(() => true)");

    // The walk: every shot measured where the tour left the page, the filmed ones planned and
    // captured, then each click made, as the viewer's would be.
    const shots = shotsOf(chapters);
    const plan = planner({ canvas });
    const filmed = [];
    const clip = { x: 0, y: 0, width: W, height: H, scale: 1 };
    for (const shot of shots) {
      if (shot.kind === "step") await page.evaluate(`window.__demoKit.film.enter(${JSON.stringify(shot.step)}).then(Boolean)`);
      await settle(page, { quiet: 400 });
      const m = await page.evaluate(`__film.measure(${JSON.stringify({ focus: shot.focus, click: shot.click?.on ?? null, scroll: shot.scroll ?? null })})`);
      for (const [what, anchor] of [["element", shot.focus], ["click", shot.click?.on]]) {
        if (anchor && !m[what === "element" ? "focus" : "click"]) {
          const named = await page.evaluate(`__film.describe(${JSON.stringify(anchor)})`);
          throw new Error(`${shot.kind === "pass" ? `step ${shot.step}'s film.via` : `step ${shot.step}`}: its ${what}, ${named}, isn't on the page`);
        }
      }
      if (shot.film) {
        const p = plan(shot, m);
        const n = frames(p, fps);
        const id = `${String(filmed.length + 1).padStart(2, "0")}-${shot.id}`;
        const at = Date.now();
        if (stills) {
          await draw(page, p, p.card ? (p.card.tin1 + p.card.tout) / 2 : p.press);
          await capture(page, clip, join(out, "stills", `${id}.jpg`));
        } else {
          const enc = encoder(join(work, "shots", `${id}.mp4`), { fps, quick });
          for (let f = 0; f < n; f++) {
            await draw(page, p, f / fps);
            await enc.write(await capture(page, clip));
          }
          await enc.end();
        }
        // The page as the shot leaves it, scrolled where its last frame shows it.
        await draw(page, p, p.dur);
        filmed.push({ shot, plan: p, dur: n / fps, file: join(work, "shots", `${id}.mp4`) });
        log(`${id}  ${(n / fps).toFixed(2)}s${stills ? "" : `, ${n} frames in ${((Date.now() - at) / 1000).toFixed(0)}s`}`);
      }
      if (shot.click) {
        await page.evaluate(`__film.press(${JSON.stringify(shot.click.on)}, ${Boolean(shot.click.double)})`);
        await sleep(500);
      }
    }
    writeFileSync(
      join(work, "plan.json"),
      JSON.stringify(
        filmed.map((s) => ({ id: s.shot.id, kind: s.shot.kind, step: s.shot.step, chapter: s.shot.chapter, dur: s.dur, focus: s.plan.m.focus, click: s.plan.m.click, camera: s.plan.cam.to })),
        null,
        1,
      ) + "\n",
    );
    if (filmed.length === 0) throw new Error("the tour has no step to film: every one is film.skip");
    if (errors.length) log(`page errors while filming:\n  ${errors.join("\n  ")}`);
    const total = filmed.reduce((a, s) => a + s.dur, 0);
    log(`${filmed.length} shots, ${total.toFixed(1)}s before dissolves`);
    if (stills) return { filmed };

    const videos = website({ filmed, chapters, name, out, work, fps, quick, copy, look: { colors: drawn.colors, font: drawn.font }, log });
    if (wide) {
      mkdirSync(join(out, "film"), { recursive: true });
      const cards = await shootCards(page, { chapters, work, fps, quick, scale });
      cutWide({ videos, cards, accent: drawn.accent, name, out, work, fps, quick, log });
    }
    return { filmed, videos };
  } finally {
    await page.close();
  }
}

const draw = (page, p, t) => page.evaluate(`__film.frame(${JSON.stringify(state(p, t))})`);

// capture is the frame as JPEG, the film's W×H clip of the page, written to file if one is given.
async function capture(page, clip, file) {
  const r = await page.send("Page.captureScreenshot", { format: "jpeg", quality: file ? 88 : 95, optimizeForSpeed: true, ...(clip ? { clip } : {}) });
  if (!r.result?.data) throw new Error(`Chrome took no screenshot: ${r.error?.message ?? "no data"}`);
  const jpeg = Buffer.from(r.result.data, "base64");
  if (file) writeFileSync(file, jpeg);
  return jpeg;
}

// shootCards films the wide film's cards at 1920×1080: the opening and closing cards and each
// chapter's, and stills of the frame each chapter's footage plays in.
async function shootCards(page, { chapters, work, fps, quick, scale }) {
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: scale, mobile: false });
  await sleep(300);
  const dir = join(work, "cards");
  const size = scale === 1 ? undefined : "1920:1080";
  const shoot = async (kind, data, dur, file) => {
    const enc = encoder(file, { fps, quick, size });
    for (let f = 0, n = Math.round(dur * fps); f < n; f++) {
      await page.evaluate(`__film.card(${JSON.stringify(kind)}, ${JSON.stringify(data)}, ${f / fps})`);
      await enc.write(await capture(page));
    }
    await enc.end();
    return file;
  };
  const cards = { frames: [], chapters: [] };
  for (const i of chapters.keys()) {
    await page.evaluate(`__film.card("frame", { i: ${i} }, 0)`);
    const r = await page.send("Page.captureScreenshot", { format: "png" });
    cards.frames.push(join(dir, `frame-${i + 1}.png`));
    writeFileSync(cards.frames[i], Buffer.from(r.result.data, "base64"));
  }
  cards.open = await shoot("open", {}, 3.4, join(dir, "open.mp4"));
  for (const i of chapters.keys()) cards.chapters.push(await shoot("chapter", { i }, 2.4, join(dir, `chapter-${i + 1}.mp4`)));
  cards.end = await shoot("end", {}, 5.0, join(dir, "end.mp4"));
  return cards;
}
