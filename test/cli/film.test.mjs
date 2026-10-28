import { test } from "node:test";
import assert from "node:assert/strict";

import { slugs, trackOf, WINDOW } from "../../cli/film-cut.mjs";
import { cut, FADE, frames, H, planner, SCENE, shotsOf, state, W } from "../../cli/film-plan.mjs";

const chapters = [
  {
    title: "The Overview",
    blurb: "One page",
    steps: [
      { id: "figures", title: "Where it stands", body: "Every figure.", to: "/overview", anchor: { section: "Headline figures" }, film: { label: "Figures" } },
      { id: "delayed", title: "The late ones", body: "Click through.", to: "/overview", anchor: { label: "Delayed" }, click: { hint: "Click Delayed." } },
    ],
  },
  {
    title: "The paperwork",
    blurb: "Reports",
    steps: [
      { id: "hidden", title: "Not filmed", body: "x", to: "/a", anchor: { section: "A" }, film: { skip: true } },
      {
        id: "reports",
        title: "Reports",
        body: "Each a PDF.",
        to: "/reports",
        anchor: { section: "Issued reports" },
        click: { on: { text: "By carrier" }, double: true, hint: "Double-click By carrier." },
        film: { via: [{ text: "Menu" }, { text: "Reports" }], zoom: 1.2, center: [600, 400], place: "left", hold: 3 },
      },
    ],
  },
];

test("a tour's shots: one a step, a pass shot for each of its film.via, a chapter's first fresh", () => {
  const shots = shotsOf(chapters);
  assert.deepEqual(
    shots.map((s) => [s.kind, s.id, s.chapter, s.film, s.fresh]),
    [
      ["step", "figures", 0, true, true],
      ["step", "delayed", 0, true, false],
      ["step", "hidden", 1, false, false],
      ["pass", "reports-via-1", 1, true, true],
      ["pass", "reports-via-2", 1, true, false],
      ["step", "reports", 1, true, false],
    ],
  );
  const [figures, delayed, , via] = shots;
  assert.equal(figures.click, null);
  assert.equal(figures.label, "Figures");
  // A click with no on clicks the anchor.
  assert.deepEqual(delayed.click, { on: { label: "Delayed" } });
  assert.equal(delayed.label, "The late ones");
  assert.deepEqual(via.click, { on: { text: "Menu" } });
  assert.equal(via.step, "reports");
  const reports = shots.at(-1);
  assert.deepEqual(reports.click, { on: { text: "By carrier" }, double: true });
  assert.deepEqual([reports.zoom, reports.center, reports.card.place, reports.hold], [1.2, [600, 400], "left", 3]);
});

const box = (x, y, w, h) => [x, y, w, h];

test("a shot frames its element, half the frame at most, and starts where the last one left off", () => {
  const [figures, delayed] = shotsOf(chapters);
  const plan = planner({ canvas: 900 });
  const a = plan(figures, { focus: box(160, 100, 1100, 100), click: null, scroll: [] });
  // A chapter's first shot opens wide; a wide element is framed at the page's width.
  assert.deepEqual(a.cam.from, { x: W / 2, y: H / 2, z: 1 });
  assert.equal(a.cam.to.z, 1);
  assert.equal(a.press, undefined);
  // A small one is framed close, no closer than 1.6, and kept on the page.
  const b = plan(delayed, { focus: box(720, 110, 260, 80), click: box(720, 110, 260, 80), scroll: [] });
  assert.deepEqual(b.cam.from, a.cam.to);
  assert.equal(b.cam.to.z, 1.6);
  assert.equal(b.cam.to.x, 850);
  assert.equal(b.cam.to.y, H / 2 / 1.6);
  assert.equal(b.curFrom.x, state(a, a.dur).cursor.x);
  // It ends on the click: the press, then a still FADE for the dissolve.
  assert.ok(Math.abs(b.dur - (b.press + 0.12 + FADE)) < 1e-9);
  const end = state(b, b.dur);
  assert.deepEqual([end.cursor.x, end.cursor.y], [850, 150]);
  // The click's ripple spreads on into the dissolve.
  assert.ok(end.ripple.k > 0.5 && end.ripple.k < 1);
});

test("a frame's state: the camera moves, the card comes and goes, nothing moves in the first FADE", () => {
  const [figures] = shotsOf(chapters);
  const p = planner()(figures, { focus: box(300, 300, 400, 200), click: null, scroll: [{ from: 0, to: 240 }] });
  const first = state(p, 0);
  assert.deepEqual(first.cam, p.cam.from);
  assert.deepEqual(state(p, FADE - 0.01).cam, p.cam.from);
  assert.deepEqual(first.scroll, [0]);
  assert.equal(first.card, undefined);
  assert.equal(first.focus, undefined);
  const read = state(p, (p.card.tin1 + p.card.tout) / 2);
  assert.equal(read.card.a, 1);
  assert.equal(read.card.title, "Where it stands");
  assert.deepEqual(read.card.box, [300, 300, 400, 200]);
  assert.equal(read.focus.a, 1);
  assert.deepEqual(read.scroll, [240]);
  const last = state(p, p.dur);
  assert.deepEqual(last.cam, p.cam.to);
  assert.equal(last.card, undefined);
  // The hold is as long as its words take, from 2.6 s.
  assert.ok(Math.abs(p.card.tout - p.card.tin1 - 2.6) < 1e-9);
});

test("a pass shot only moves to its click and takes it, and film hints set the framing and hold", () => {
  const shots = shotsOf(chapters).filter((s) => s.film);
  const plan = planner();
  const ps = shots.map((s) => plan(s, { focus: s.focus ? box(200, 300, 300, 120) : null, click: s.click ? box(100, 60, 80, 30) : null, scroll: [] }));
  const via = ps[2];
  assert.equal(via.card, undefined);
  assert.equal(via.focus, undefined);
  assert.ok(via.press < 1.5);
  // A chapter's first shot opens wide again, its cursor coming in from the corner.
  assert.deepEqual(via.cam.from, { x: W / 2, y: H / 2, z: 1 });
  const reports = ps[4];
  assert.deepEqual([reports.cam.to.x, reports.cam.to.y, reports.cam.to.z], [600, 400, 1.2]);
  assert.equal(reports.card.place, "left");
  assert.ok(Math.abs(reports.card.tout - reports.card.tin1 - 3) < 1e-9);
});

test("a cut: shots dissolve FADE into each other and SCENE into a chapter, and each step runs from its first shot", () => {
  const shots = shotsOf(chapters).filter((s) => s.film);
  const plan = planner();
  const filmed = shots.map((shot) => {
    const p = plan(shot, { focus: shot.focus ? box(200, 300, 300, 120) : null, click: shot.click ? box(100, 60, 80, 30) : null, scroll: [] });
    return { shot, plan: p, dur: frames(p, 60) / 60 };
  });
  const c = cut(filmed);
  const d = filmed.map((f) => f.dur);
  assert.equal(c.starts[0], 0);
  assert.ok(Math.abs(c.starts[1] - (d[0] - FADE)) < 1e-9);
  assert.ok(Math.abs(c.starts[2] - (c.starts[1] + d[1] - SCENE)) < 1e-9);
  assert.ok(Math.abs(c.duration - (c.starts[4] + d[4])) < 1e-9);
  assert.deepEqual(
    c.steps.map((s) => [s.id, s.chapter, s.label]),
    [
      ["figures", 0, "Figures"],
      ["delayed", 0, "The late ones"],
      ["reports", 1, "Reports"],
    ],
  );
  // A step with pass shots starts at its first; its card is on screen in its own shot.
  const reports = c.steps[2];
  assert.equal(reports.start, c.starts[2]);
  assert.ok(Math.abs(reports.at - (c.starts[4] + filmed[4].plan.card.tin1)) < 1e-9);
  // A chapter's own video starts it from nothing.
  assert.equal(cut(filmed.slice(2)).starts[0], 0);
});

test("chapter file names are unique words; the tracks share the window's width", () => {
  assert.deepEqual(slugs(["The Overview", "Find the late ones!", "The overview", "Ünïcode & more"]), ["the-overview", "find-the-late-ones", "the-overview-2", "unicode-more"]);
  const tracks = [0, 1, 2].map((i) => trackOf(i, 3));
  assert.equal(tracks[0].x, WINDOW.x);
  assert.ok(Math.abs(tracks[2].x + tracks[2].w - (WINDOW.x + WINDOW.w)) <= 1);
});
