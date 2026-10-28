// The film's edit, in ffmpeg: filmed shots cut, with dissolves, into what a website plays (a 2:1
// video of the whole tour and one of each chapter, each in the encodes a page wants, their steps'
// timings, and a reference module that plays them), and the cards and footage of the 16:9 film.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cut, fadeInto } from "./film-plan.mjs";

// The wide film's 1920×1080 frame: WINDOW is where a chapter's footage plays, TRACK the bar under
// each chapter's name that fills as it plays.
export const WINDOW = { x: 160, y: 64, w: 1600, h: 800, r: 18 };
export const TRACK = { y: 952, h: 3, gap: 28 };

// needFfmpeg fails unless an ffmpeg with the encoders the film writes is on the PATH.
export function needFfmpeg() {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error("film needs ffmpeg on the PATH (brew install ffmpeg, or apt-get install ffmpeg)");
  for (const enc of ["libx264", "libvpx-vp9"]) if (!r.stdout.includes(enc)) throw new Error(`film needs an ffmpeg built with ${enc}`);
}

const ff = (args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const master = ({ fps, quick }) => ["-c:v", "libx264", "-preset", quick ? "veryfast" : "slow", "-crf", quick ? "16" : "12", "-pix_fmt", "yuv420p", "-r", String(fps)];
const t2 = (s) => Math.round(s * 100) / 100;

// encoder takes JPEG or PNG frames at fps into a near-lossless mp4, scaled to size ("w:h") if given.
export function encoder(file, { fps, quick, size }) {
  const proc = spawn(
    "ffmpeg",
    ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", ...(size ? ["-vf", `scale=${size}:flags=lanczos`] : []),
      "-c:v", "libx264", "-preset", quick ? "ultrafast" : "medium", "-crf", quick ? "16" : "10", "-pix_fmt", "yuv420p", "-r", String(fps), file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  // A write after ffmpeg has failed is reported by its exit, not by a broken pipe.
  proc.stdin.on("error", () => {});
  const done = new Promise((r, j) => proc.on("exit", (c) => (c === 0 ? r() : j(new Error(`ffmpeg exited ${c} making ${file}`)))));
  return {
    async write(frame) {
      if (!proc.stdin.write(frame)) await Promise.race([new Promise((r) => proc.stdin.once("drain", r)), done]);
    },
    end() {
      proc.stdin.end();
      return done;
    },
  };
}

// dissolve joins files, the ith starting at starts[i] and dissolving into the one before over fades[i].
function dissolve(files, starts, fades, out, opts) {
  let graph = "";
  let last = "[0:v]";
  for (let i = 1; i < files.length; i++) {
    const o = i === files.length - 1 ? "[v]" : `[x${i}]`;
    graph += `${last}[${i}:v]xfade=transition=fade:duration=${fades[i]}:offset=${starts[i].toFixed(4)}${o};`;
    last = o;
  }
  if (files.length === 1) graph = "[0:v]null[v];";
  ff([...files.flatMap((f) => ["-i", f]), "-filter_complex", graph.slice(0, -1), "-map", "[v]", ...master(opts), out]);
}

// web writes what a page plays from a master: H.264 at 1920×960 and, lighter, 1280×640 at 30 fps;
// VP9 at 1920×960; and the first frame as a poster.
function web(from, base, { quick }) {
  const sz = (w, h) => `scale=${w}:${h}:flags=lanczos`;
  const x264 = (crf) => ["-c:v", "libx264", "-preset", quick ? "veryfast" : "slow", "-crf", crf, "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];
  ff(["-i", from, "-vf", sz(1920, 960), ...x264("19"), `${base}-1920x960.mp4`]);
  ff(["-i", from, "-vf", `${sz(1280, 640)},fps=30`, ...x264("21"), `${base}-1280x640.mp4`]);
  const vp9 = quick ? ["-deadline", "realtime", "-cpu-used", "8"] : ["-deadline", "good", "-cpu-used", "2"];
  ff(["-i", from, "-vf", sz(1920, 960), "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-row-mt", "1", ...vp9, "-an", `${base}-1920x960.webm`]);
  ff(["-ss", "0.2", "-i", from, "-frames:v", "1", "-vf", sz(1920, 960), "-q:v", "2", `${base}-poster.jpg`]);
}

const vttTime = (s) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23);
const html = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// json is JSON to write inside a <script>, which no string in it can close.
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

// slugs is a file-name word for each title, unique among them.
export function slugs(titles) {
  const seen = new Set();
  return titles.map((t, i) => {
    let s = String(t).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "") || `chapter-${i + 1}`;
    while (seen.has(s)) s += "-2";
    seen.add(s);
    return s;
  });
}

// website cuts the filmed shots ({ shot, plan, dur, file }) into the whole tour and each chapter,
// and writes their encodes, captions and timings.json into out/website with the reference module.
export function website({ filmed, chapters, name, out, work, fps, quick, copy, look, log }) {
  const ids = slugs(chapters.map((c) => c.title));
  const videos = [
    { name: `${name}-walkthrough`, shots: filmed },
    ...chapters.map((c, i) => ({ name: `${name}-chapter-${i + 1}-${ids[i]}`, chapter: i, shots: filmed.filter((s) => s.shot.chapter === i) })),
  ].filter((v) => v.shots.length > 0);
  const timings = { fps, aspect: "2:1", videos: {} };
  for (const v of videos) {
    const c = cut(v.shots);
    v.master = join(work, "masters", `${v.name}.mp4`);
    v.duration = c.duration;
    dissolve(
      v.shots.map((s) => s.file),
      c.starts,
      v.shots.map(fadeInto),
      v.master,
      { fps, quick },
    );
    web(v.master, join(out, "website", v.name), { quick });
    const steps = c.steps.map((s) => ({ id: s.id, chapter: ids[s.chapter], label: s.label, title: s.title, body: s.body, start: t2(s.start), at: t2(s.at) }));
    timings.videos[v.name] = {
      duration: t2(c.duration),
      chapters: chapters
        .map((ch, i) => ({ id: ids[i], title: ch.title, blurb: ch.blurb, at: t2(c.starts[v.shots.findIndex((s) => s.shot.chapter === i)] ?? -1) }))
        .filter((ch) => ch.at >= 0),
      steps,
    };
    writeFileSync(
      join(out, "website", `${v.name}.vtt`),
      "WEBVTT\n\n" + steps.map((s, i) => `${i + 1}\n${vttTime(s.at)} --> ${vttTime(steps[i + 1]?.at ?? c.duration)}\n${s.title}\n`).join("\n"),
    );
    log(`${v.name}: ${v.shots.length} shots, ${c.duration.toFixed(1)}s`);
  }
  writeFileSync(join(out, "website", "timings.json"), JSON.stringify(timings, null, 2) + "\n");

  // The reference module, with the timings it reads written in, so it opens from the folder.
  const tabs = videos.filter((v) => v.chapter !== undefined).map((v) => ({ id: ids[v.chapter], title: chapters[v.chapter].title, video: v.name }));
  const page = readFileSync(new URL("./film-embed.html", import.meta.url), "utf8")
    .replaceAll("__TITLE__", () => html(copy.product))
    .replace("__HEADING__", () => html(copy.heading))
    .replace("__LEDE__", () => html(copy.lede))
    .replace("__CTA__", () => (copy.contact ? `<a class="cta" href="${html(copy.contact.href)}">${html(copy.contact.label)} →</a>` : ""))
    .replace("__COLORS__", () => Object.entries(look.colors).map(([k, v]) => `--${k}: ${v};`).join(" "))
    .replace("__FONT__", () => look.font)
    .replace("__TIMINGS__", () => json(timings))
    .replace("__TABS__", () => json(tabs));
  writeFileSync(join(out, "website", "embed-example.html"), page);
  return videos;
}

// trackOf is the progress track of chapter i of n in the wide frame, in its px.
export function trackOf(i, n) {
  const w = (WINDOW.w - (n - 1) * TRACK.gap) / n;
  return { x: Math.round(WINDOW.x + i * (w + TRACK.gap)), y: TRACK.y, w: Math.round(w), h: TRACK.h };
}

const duration = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" });

// wide cuts the 16:9 film: the opening card, each chapter's card then its footage in the window
// above the chapters, its own track filling as it plays, and the closing card. cards holds the
// filmed cards and the stills each chapter's footage plays over.
export function wide({ videos, cards, accent, name, out, work, fps, quick, log }) {
  const { w: W, h: H, r } = WINDOW;
  // The window's rounded corners, as a mask the footage is cut by.
  const mask = join(work, "cards", "window-mask.png");
  ff(["-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:d=1`, "-frames:v", "1", "-vf",
    `format=gray,geq=lum='255*clip(${r}+0.5-hypot(max(max(${r}-X-0.5\\,X+0.5-${W - r})\\,0)\\,max(max(${r}-Y-0.5\\,Y+0.5-${H - r})\\,0))\\,0\\,1)'`, mask]);
  const chapters = videos.filter((v) => v.chapter !== undefined);
  const n = cards.frames.length;
  const parts = [{ file: cards.open, fade: 0 }];
  for (const [k, v] of chapters.entries()) {
    const i = v.chapter;
    const D = v.duration.toFixed(3);
    const tr = trackOf(i, n);
    const framed = join(work, "masters", `${v.name}-framed.mp4`);
    ff(["-loop", "1", "-framerate", String(fps), "-i", cards.frames[i], "-i", v.master, "-loop", "1", "-i", mask,
      "-f", "lavfi", "-i", `color=c=0x${accent.slice(1)}:s=${tr.w}x${tr.h}:r=${fps}`,
      "-filter_complex",
      `[0:v]scale=1920:1080:flags=lanczos,format=rgb24,split[bg][bg2];` +
        `[bg2]crop=${tr.w}:${tr.h}:${tr.x}:${tr.y}[trk];[trk][3:v]overlay=x='-overlay_w+overlay_w*min(1,t/${D})':y=0:eval=frame[trkf];` +
        `[1:v]scale=${W}:${H}:flags=lanczos,format=rgba[app];[2:v]format=gray[m];[app][m]alphamerge[win];` +
        `[bg][win]overlay=${WINDOW.x}:${WINDOW.y}:shortest=1[b2];[b2][trkf]overlay=${tr.x}:${tr.y}:shortest=1,format=yuv420p[v]`,
      "-map", "[v]", "-t", D, ...master({ fps, quick }), framed]);
    parts.push({ file: cards.chapters[i], fade: k ? 0.5 : 0.6 });
    parts.push({ file: framed, fade: 0.5 });
  }
  parts.push({ file: cards.end, fade: 0.6 });
  const starts = [];
  let at = 0;
  parts.forEach((p, i) => {
    p.dur = duration(p.file);
    if (i > 0) at += parts[i - 1].dur - p.fade;
    starts.push(at);
  });
  const whole = join(work, "masters", `${name}-film.mp4`);
  dissolve(
    parts.map((p) => p.file),
    starts,
    parts.map((p) => p.fade),
    whole,
    { fps, quick },
  );
  const base = join(out, "film", `${name}-film`);
  ff(["-i", whole, "-c:v", "libx264", "-preset", quick ? "veryfast" : "slow", "-crf", "17", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", `${base}-1920x1080.mp4`]);
  ff(["-ss", "1.6", "-i", whole, "-frames:v", "1", "-q:v", "2", `${base}-poster.jpg`]);
  log(`${name}-film: ${duration(whole).toFixed(1)}s`);
}
