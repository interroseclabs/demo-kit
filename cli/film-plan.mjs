// The film's plan, apart from Chrome: the shots a tour makes, each shot's moves on a timeline
// (camera, scroll, cursor, spotlight, callout, click), and where each shot and step falls in a cut.
// A shot starts where the one filmed before it left the camera and the cursor, so cutting between
// shots with a short dissolve reads as the app responding. state is what a frame draws.

// The frame, 2:1, in the page's px: the page is laid out 1440 wide and the camera moves over it.
export const W = 1440;
export const H = 720;
// FADE is the dissolve between shots, so nothing moves in a shot's first and last FADE; SCENE is
// the slower one into a chapter.
export const FADE = 0.35;
export const SCENE = 0.6;
const MAX_ZOOM = 1.6;
// Where the cursor comes in from, at a chapter's start.
const ENTER = { x: 1210, y: 650 };

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const clamp01 = (t) => clamp(t, 0, 1);
export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  // A hand on a mouse: a quick start, a long settle.
  hand: (t) => 0.35 * ease.inOut(t) + 0.65 * (1 - Math.pow(1 - t, 4)),
};
const span = (t, t0, t1, e = ease.inOut) => (t1 <= t0 ? (t >= t1 ? 1 : 0) : e(clamp01((t - t0) / (t1 - t0))));
const mix = (a, b, k) => a + (b - a) * k;
const centre = (b) => ({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });
const words = (s) => s.split(/\s+/).filter(Boolean).length;

// arc is a point along a gentle curve from p to q, bowed upward like a wrist's sweep.
function arc(p, q, k) {
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d;
  let ny = dx / d;
  if (ny > 0) (nx = -nx), (ny = -ny);
  const bow = Math.min(90, d * 0.14);
  const c = { x: mx + nx * bow, y: my + ny * bow };
  const u = 1 - k;
  return { x: u * u * p.x + 2 * u * k * c.x + k * k * q.x, y: u * u * p.y + 2 * u * k * c.y + k * k * q.y };
}

// shotsOf is the shots a tour's chapters make, in order. A step makes one: the camera frames its
// element, rings it and puts its card beside it, then takes its click, if it has one. Each anchor
// in its film.via makes a pass shot before it, which only moves to it and clicks. A chapter's
// first filmed shot is fresh: the camera starts wide and the cursor comes in from the corner. A
// skipped step's shots are walked, for the page's sake, and not filmed.
export function shotsOf(chapters) {
  const shots = [];
  chapters.forEach((chapter, c) => {
    let fresh = true;
    for (const step of chapter.steps) {
      const f = step.film ?? {};
      const film = !f.skip;
      for (const [k, on] of (f.via ?? []).entries()) {
        shots.push({ kind: "pass", id: `${step.id}-via-${k + 1}`, step: step.id, chapter: c, film, fresh: film && fresh, focus: null, click: { on } });
        if (film) fresh = false;
      }
      const on = step.click ? (step.click.on ?? step.anchor) : undefined;
      shots.push({
        kind: "step",
        id: step.id,
        step: step.id,
        chapter: c,
        film,
        fresh: film && fresh,
        focus: step.anchor ?? null,
        click: on ? { on, ...(step.click.double ? { double: true } : {}) } : null,
        card: { title: step.title, body: step.body, place: f.place },
        label: f.label ?? step.title,
        zoom: f.zoom,
        center: f.center,
        scroll: f.scroll,
        hold: f.hold,
      });
      if (film) fresh = false;
    }
  });
  return shots;
}

// framing is where the camera ends a shot: on what it shows, as close as leaves that half the
// frame, kept on the page.
function framing(shot, box, cam, canvas) {
  const pass = shot.kind === "pass";
  const fit = box ? Math.min((0.5 * W) / Math.max(box[2], 1), (0.5 * H) / Math.max(box[3], 1)) : 1;
  const z = shot.zoom ?? (pass ? clamp(cam.z, 1, 1.3) : clamp(fit, 1, MAX_ZOOM));
  const c = shot.center ? { x: shot.center[0], y: shot.center[1] } : box ? centre(box) : { x: W / 2, y: H / 2 };
  const hw = W / 2 / z;
  const hh = H / 2 / z;
  return { x: clamp(c.x, hw, W - hw), y: clamp(c.y, hh, canvas - hh), z };
}

// union is the box round a and b, either of which may be missing.
const union = (a, b) => {
  if (!a || !b) return a ?? b ?? null;
  const l = Math.min(a[0], b[0]);
  const t = Math.min(a[1], b[1]);
  return [l, t, Math.max(a[0] + a[2], b[0] + b[2]) - l, Math.max(a[1] + a[3], b[1] + b[3]) - t];
};

// inView keeps a point inside what the camera shows, a margin in from its edge.
const inView = (pt, cam) => {
  const hw = W / 2 / cam.z;
  const hh = H / 2 / cam.z;
  const m = 36 / cam.z;
  return { x: clamp(pt.x, cam.x - hw + m, cam.x + hw - m), y: clamp(pt.y, cam.y - hh + m, cam.y + hh - m) };
};

const clickPoint = (b) => ({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });

// restPoint is where the cursor waits while the card is read: on the element without hiding it,
// low and to the right on a big one, in the middle of a small one.
function restPoint(b) {
  return b[2] < 260 && b[3] < 90 ? centre(b) : { x: b[0] + Math.min(b[2] * 0.72, b[2] - 40), y: b[1] + Math.min(b[3] * 0.7, b[3] - 24) };
}

// planner plans shots one after another, each from where the last left the camera and cursor.
// m is what was measured of the shot on the page, the page laid out canvas px tall: boxes as
// [x, y, width, height] of its focus and click, and the scrolls that bring them into view.
export function planner({ canvas = 900 } = {}) {
  let cam = null;
  let cur = null;
  return (shot, m) => {
    if (shot.fresh || !cam) {
      cam = { x: W / 2, y: H / 2, z: 1 };
      cur = { ...ENTER };
    }
    const pass = shot.kind === "pass";
    const t0 = FADE;
    const target = framing(shot, pass ? m.click : union(m.focus, m.click), cam, canvas);
    const moves = Math.hypot(cam.x - target.x, cam.y - target.y) > 2 || Math.abs(cam.z - target.z) > 0.01;
    const p = { shot, m, curFrom: { ...cur }, cam: { from: { ...cam }, to: target, t0, t1: moves ? t0 + (pass ? 0.85 : 1.15) : t0 } };
    if (m.scroll?.length) p.scroll = { list: m.scroll, t0: t0 + 0.1, t1: t0 + 1.2 };

    if (pass) {
      const c = inView(clickPoint(m.click), target);
      p.cur = [{ from: { ...cur }, to: c, t0: t0 + 0.05, t1: t0 + 0.75 }];
      p.press = t0 + 0.82;
      p.dur = p.press + 0.12 + FADE;
      cur = c;
    } else {
      const rest = m.focus ? inView(restPoint(m.focus), target) : inView(cur, target);
      p.cur = [{ from: { ...cur }, to: rest, t0: t0 + 0.2, t1: t0 + 1.1 }];
      const hold = shot.hold ?? clamp(0.8 + 0.16 * words(`${shot.card.title} ${shot.card.body}`), 2.6, 5);
      p.card = { ...shot.card, tin: t0 + 1.15, tin1: t0 + 1.55 };
      const tc = p.card.tin1 + hold;
      p.card.tout = tc;
      p.card.tout1 = tc + 0.3;
      if (m.focus) p.focus = { box: m.focus, tin: t0 + 1.0, tin1: t0 + 1.35, tout: tc, tout1: tc + 0.3 };
      cur = rest;
      if (m.click) {
        const c = inView(clickPoint(m.click), target);
        p.cur.push({ from: rest, to: c, t0: tc + 0.05, t1: tc + 0.7 });
        p.press = tc + 0.78;
        p.dur = p.press + 0.12 + FADE;
        cur = c;
      } else p.dur = tc + 0.3 + 0.15 + FADE;
    }
    cam = target;
    return p;
  };
}

// state is everything a frame draws, at t seconds into a planned shot.
export function state(p, t) {
  const k = span(t, p.cam.t0, p.cam.t1, ease.inOutQuart);
  const s = { cam: { x: mix(p.cam.from.x, p.cam.to.x, k), y: mix(p.cam.from.y, p.cam.to.y, k), z: mix(p.cam.from.z, p.cam.to.z, k) } };
  if (p.scroll) {
    const ks = span(t, p.scroll.t0, p.scroll.t1, ease.inOutQuart);
    s.scroll = p.scroll.list.map((sc) => mix(sc.from, sc.to, ks));
  }
  let pos = p.curFrom;
  for (const c of p.cur) if (t >= c.t0) pos = arc(c.from, c.to, span(t, c.t0, c.t1, ease.hand));
  let press = 0;
  if (p.press != null) press = t < p.press - 0.07 ? 0 : t < p.press ? (t - (p.press - 0.07)) / 0.07 : Math.max(0, 1 - (t - p.press) / 0.14);
  s.cursor = { x: pos.x, y: pos.y, press };
  if (p.press != null && t >= p.press) s.ripple = { x: pos.x, y: pos.y, k: Math.min(1, (t - p.press) / 0.55) };
  if (p.focus) {
    const a = span(t, p.focus.tin, p.focus.tin1, ease.out) * (1 - span(t, p.focus.tout, p.focus.tout1, ease.inOut));
    if (a > 0) s.focus = { box: p.focus.box, a };
  }
  if (p.card) {
    const a = span(t, p.card.tin, p.card.tin1, ease.out) * (1 - span(t, p.card.tout, p.card.tout1, ease.inOut));
    if (a > 0) s.card = { title: p.card.title, body: p.card.body, place: p.card.place, box: p.focus?.box ?? null, a };
  }
  return s;
}

// frames is how many frames a planned shot takes at fps; a shot lasts exactly that many.
export const frames = (p, fps) => Math.round(p.dur * fps);

// cut is where each filmed shot starts in a video made of them, dissolving FADE into each and
// SCENE into a chapter's first, and where each step runs: from its first shot's start, its card
// fully on screen at `at`. shots are { shot, plan, dur } in order.
export function cut(shots) {
  const starts = [];
  let at = 0;
  shots.forEach((s, i) => {
    if (i > 0) at += shots[i - 1].dur - fadeInto(s, i);
    starts.push(at);
  });
  const steps = [];
  shots.forEach((s, i) => {
    let step = steps.find((x) => x.id === s.shot.step);
    if (!step) steps.push((step = { id: s.shot.step, chapter: s.shot.chapter, start: starts[i] }));
    if (s.shot.kind === "step") Object.assign(step, { label: s.shot.label, title: s.shot.card.title, body: s.shot.card.body, at: starts[i] + s.plan.card.tin1 });
  });
  const last = shots.length - 1;
  return { starts, steps, duration: last < 0 ? 0 : starts[last] + shots[last].dur };
}

// fadeInto is the dissolve into the ith shot of a cut.
export const fadeInto = (s, i) => (i === 0 ? 0 : s.shot.fresh ? SCENE : FADE);
