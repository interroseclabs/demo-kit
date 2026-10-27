import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Compass, Hand, ListOrdered, MousePointerClick, Play, RotateCcw, X } from "lucide-preact";

import { findAnchor, sameRoute, screenBox, scrollerOf, waitForAnchor, windowsOf, type Anchor } from "./anchor.js";
import type { DemoConfig } from "./config.js";
import { place, visibleBox, type Box } from "./place.js";
import type { Chapter, TourRouter, TourStep, Where } from "./steps.js";

// The demo is in one of four modes: the welcome, the guided tour, exploring freely, and the end.
type Mode = "intro" | "guided" | "explore" | "outro";
type Step = TourStep & { chapter: number; index: number };

// TourText is what the frame says that is the app's own: its name, its welcome and its end.
export type TourText = {
  // The bar's name for the demo: "qSIGHT interactive demo".
  title: string;
  welcome: {
    // The line over the heading; the prospect's name follows it.
    kicker?: string;
    heading: string;
    body: string;
  };
  end: { heading?: string; points: string[] };
};

export type TourProps = {
  router: TourRouter;
  chapters: Chapter[];
  config: DemoConfig;
  text: TourText;
  // What the dim leaves uncovered at the window's foot, such as the app's own status bar, in px.
  bottomInset: number;
  storageKey: string;
};

// BAR is the demo bar's height; PAD the room the spotlight leaves around what it lights.
export const BAR = 44;
const PAD = 6;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Progress, kept per viewer ─────────────────────────────────────────────────────

type Saved = { at: number; seen: string[] };

function loadSaved(key: string): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as Saved | null;
    if (v && typeof v.at === "number" && Array.isArray(v.seen)) return v;
  } catch {
    // A private window, or a page opened where storage is refused: the tour starts afresh.
  }
  return { at: 0, seen: [] };
}

function save(key: string, v: Saved) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // As above: progress is a convenience, never needed.
  }
}

// ── The page under the tour ───────────────────────────────────────────────────────

// press is a viewer's click, or double-click, on e, in the window e is in: a frame's, maybe.
function press(e: HTMLElement, double?: boolean) {
  const view = e.ownerDocument.defaultView ?? window;
  if (double) e.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view }));
  else e.click();
}

// shut closes what a step opened, a dialog or an inspector, as Escape or its close button does.
function shut(open: Anchor) {
  const e = findAnchor(open);
  if (!e) return;
  const doc = e.ownerDocument;
  for (const t of new Set<EventTarget>([document, window, doc, doc.defaultView ?? window])) {
    t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
  setTimeout(() => {
    const still = findAnchor(open);
    const close =
      still &&
      [...still.querySelectorAll<HTMLElement>("button")].find(
        (b) => /^close/i.test(b.getAttribute("aria-label") ?? "") || b.textContent?.trim() === "×" || b.textContent?.trim() === "Close",
      );
    close?.click();
  }, 60);
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (!!a && !!b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

// useBox is where on screen anchor's element is, each frame, found again if the page redraws it,
// through any frame it is in.
function useBox(anchor: Anchor | undefined, found: HTMLElement | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  const active = Boolean(anchor || found);
  useEffect(() => {
    if (!active) return;
    let el = found;
    let frame = 0;
    let raf = 0;
    const tick = () => {
      if ((!el || !el.isConnected) && anchor && frame++ % 10 === 0) el = findAnchor(anchor);
      const r = el?.isConnected ? screenBox(el) : null;
      const next = r && r.width > 0 ? r : null;
      setBox((prev) => (sameBox(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, anchor, found]);
  return active ? box : null;
}

function useViewport(bottomInset: number): Box {
  const read = () => ({ left: 0, top: BAR, width: window.innerWidth, height: window.innerHeight - BAR - bottomInset });
  const [view, setView] = useState(read);
  useEffect(() => {
    const on = () => setView(read());
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
    // read is made from bottomInset alone.
  }, [bottomInset]);
  return view;
}

function useLocation(router: TourRouter): Where {
  const [at, setAt] = useState(() => router.location());
  useEffect(() => router.subscribe(() => setAt(router.location())), [router]);
  return at;
}

// typing is whether a key goes into a field: in a frame's page too, whose elements are its own window's.
const typing = (t: EventTarget | null) => {
  const e = t as HTMLElement | null;
  return Boolean(e && e.nodeType === 1 && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)));
};

// ── The demo ──────────────────────────────────────────────────────────────────────

// DemoTour frames the recorded app with Walnut's two ways of showing a product: a guided tour that
// dims the page around each stop and goes on as the viewer clicks what it points at, and free
// exploring, with the tour's stops left on the page as hotspots. The bar above switches between
// them, lists the chapters, and carries the call to action.
export function DemoTour({ router, chapters, config, text, bottomInset, storageKey }: TourProps) {
  const steps = useMemo<Step[]>(
    () => chapters.flatMap((c, chapter) => c.steps.map((s) => ({ ...s, chapter }))).map((s, index) => ({ ...s, index })),
    [chapters],
  );
  const saved = useMemo(() => loadSaved(storageKey), [storageKey]);
  const [mode, setMode] = useState<Mode>("intro");
  const [at, setAt] = useState(Math.min(saved.at, Math.max(steps.length - 1, 0)));
  const [seen, setSeen] = useState(() => new Set(saved.seen));
  const location = useLocation(router);

  useEffect(() => save(storageKey, { at, seen: [...seen] }), [storageKey, at, seen]);
  const markSeen = useCallback((id: string) => setSeen((s) => (s.has(id) ? s : new Set(s).add(id))), []);

  const guide = useCallback((i: number) => {
    setAt(i);
    setMode("guided");
  }, []);
  const next = useCallback(() => {
    if (at + 1 >= steps.length) setMode("outro");
    else setAt(at + 1);
  }, [at, steps.length]);
  const back = useCallback(() => setAt((i) => Math.max(0, i - 1)), []);

  if (steps.length === 0) return null;
  const step = steps[at]!;

  return (
    <>
      <DemoBar
        mode={mode}
        step={step}
        total={steps.length}
        chapters={chapters}
        steps={steps}
        seen={seen}
        config={config}
        title={text.title}
        onGuide={() => guide(at)}
        onExplore={() => setMode("explore")}
        onChapter={(c) => guide(steps.findIndex((s) => s.chapter === c))}
      />
      {mode === "guided" && (
        <Guided
          key={step.id}
          router={router}
          step={step}
          before={steps[at - 1]}
          total={steps.length}
          chapter={chapters[step.chapter]!}
          chapters={chapters.length}
          bottomInset={bottomInset}
          onNext={next}
          onBack={back}
          onExplore={() => setMode("explore")}
          onSeen={markSeen}
        />
      )}
      {mode === "explore" && <Explore steps={steps} location={location} at={at} bottomInset={bottomInset} onGuide={guide} />}
      {mode === "intro" && (
        <Intro
          chapters={chapters}
          text={text}
          minutes={Math.max(3, Math.round((steps.length * 18) / 60))}
          config={config}
          resume={saved.at > 0 && saved.at < steps.length ? steps[saved.at] : undefined}
          onStart={(i) => guide(i)}
          onExplore={() => setMode("explore")}
        />
      )}
      {mode === "outro" && <Outro text={text} config={config} onExplore={() => setMode("explore")} onRestart={() => guide(0)} />}
    </>
  );
}

// ── The bar ───────────────────────────────────────────────────────────────────────

function DemoBar({
  mode,
  step,
  total,
  chapters,
  steps,
  seen,
  config,
  title,
  onGuide,
  onExplore,
  onChapter,
}: {
  mode: Mode;
  step: Step;
  total: number;
  chapters: Chapter[];
  steps: Step[];
  seen: Set<string>;
  config: DemoConfig;
  title: string;
  onGuide: () => void;
  onExplore: () => void;
  onChapter: (chapter: number) => void;
}) {
  const guided = mode === "guided" || mode === "intro" || mode === "outro";
  const progress = mode === "outro" ? 1 : (step.index + (mode === "guided" ? 1 : 0)) / total;
  return (
    <header class="gd-bar" data-gd="bar">
      <div class="gd-bar-side">
        <span aria-hidden="true" class="gd-bar-mark">
          <Compass size={14} />
        </span>
        <span class="gd-bar-title">
          {title}
          {config.prospect && <span class="gd-bar-prospect"> · prepared for {config.prospect}</span>}
        </span>
      </div>
      <div role="group" aria-label="How to see the demo" class="gd-modes">
        <ModeButton active={guided} onClick={onGuide} icon={<Play size={12} />} label="Guided tour" />
        <ModeButton active={mode === "explore"} onClick={onExplore} icon={<Hand size={12} />} label="Explore freely" />
      </div>
      <div class="gd-bar-side gd-bar-end">
        <Contents chapters={chapters} steps={steps} seen={seen} current={mode === "guided" ? step.chapter : null} onChapter={onChapter} />
        {config.contact && (
          <a href={config.contact.href} target="_blank" rel="noopener noreferrer" class="gd-btn gd-btn-primary gd-btn-sm gd-bar-cta" data-gd="contact">
            {config.contact.label}
          </a>
        )}
      </div>
      <div aria-hidden="true" class="gd-progress">
        <div class="gd-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ComponentChildren; label: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} class={cx("gd-mode", active && "gd-mode-on")}>
      {icon}
      <span class="gd-mode-label">{label}</span>
    </button>
  );
}

// Contents is the tour's chapter list, as Walnut's guides toolbar lists its guides.
function Contents({
  chapters,
  steps,
  seen,
  current,
  onChapter,
}: {
  chapters: Chapter[];
  steps: Step[];
  seen: Set<string>;
  current: number | null;
  onChapter: (chapter: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // The tour is in a shadow root, so a click's target, seen from the document, is the root's host.
    const away = (e: MouseEvent) => box.current && !e.composedPath().includes(box.current) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} class="gd-contents">
      <button type="button" class="gd-btn gd-btn-ghost gd-btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ListOrdered size={14} aria-hidden="true" />
        <span class="gd-contents-label">{current === null ? "Chapters" : `Chapter ${current + 1} of ${chapters.length}`}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <nav aria-label="Tour chapters" class="gd-chapters gd-pop">
          {chapters.map((c, i) => {
            const own = steps.filter((s) => s.chapter === i);
            const done = own.every((s) => seen.has(s.id));
            return (
              <button
                key={c.title}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onChapter(i);
                }}
                class={cx("gd-chapter", current === i && "gd-chapter-on")}
              >
                <span class={cx("gd-num", done && "gd-num-done")}>{done ? <Check size={12} aria-label="Seen" /> : i + 1}</span>
                <span class="gd-chapter-words">
                  <span class="gd-chapter-title">{c.title}</span>
                  <span class="gd-chapter-blurb">
                    {c.blurb} · {own.length} {own.length === 1 ? "step" : "steps"}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// ── The guided tour ───────────────────────────────────────────────────────────────

function Guided({
  router,
  step,
  before,
  total,
  chapter,
  chapters,
  bottomInset,
  onNext,
  onBack,
  onExplore,
  onSeen,
}: {
  router: TourRouter;
  step: Step;
  before: Step | undefined;
  total: number;
  chapter: Chapter;
  chapters: number;
  bottomInset: number;
  onNext: () => void;
  onBack: () => void;
  onExplore: () => void;
  onSeen: (id: string) => void;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [clickFound, setClickFound] = useState(false);
  const [nudge, setNudge] = useState(0);
  const moved = useRef(false);
  const view = useViewport(bottomInset);
  const clickAnchor = step.click ? (step.click.on ?? step.anchor) : undefined;

  // Entering the step: its page, what it needs open, and its element scrolled into view.
  useEffect(() => {
    const stop = new AbortController();
    const { signal } = stop;
    (async () => {
      // A step left by its click lets the click's own navigation land before reading the route.
      await new Promise((r) => setTimeout(r, 120));
      if (signal.aborted) return;
      if (!sameRoute(router.location(), step.to)) await router.navigate(step.to);
      else if (before?.needs && JSON.stringify(before.needs) !== JSON.stringify(step.needs)) shut(before.needs.open);
      if (step.needs && !(await waitForAnchor(step.needs.open, 900, signal))) {
        const by = await waitForAnchor(step.needs.by, 6000, signal);
        if (by) press(by, step.needs.double);
        await waitForAnchor(step.needs.open, 3000, signal);
      }
      const el = step.anchor ? await waitForAnchor(step.anchor, 6000, signal) : null;
      if (signal.aborted) return;
      if (el) {
        const tall = el.getBoundingClientRect().height > (window.innerHeight - BAR - bottomInset) * 0.7;
        el.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      const clickEl = clickAnchor ? (clickAnchor === step.anchor ? el : await waitForAnchor(clickAnchor, 3000, signal)) : null;
      if (signal.aborted) return;
      setTarget(el);
      setClickFound(Boolean(clickEl));
      setReady(true);
      onSeen(step.id);
    })();
    return () => stop.abort();
    // The step is the component's key: each is entered once.
  }, []);

  const go = useCallback(() => {
    if (moved.current) return;
    moved.current = true;
    onNext();
  }, [onNext]);

  // A click step goes on when the viewer clicks what it points at, on the page or in a frame of it.
  useEffect(() => {
    if (!ready || !clickAnchor) return;
    const type = step.click?.double ? "dblclick" : "click";
    const on = (e: Event) => {
      const want = findAnchor(clickAnchor);
      const t = e.target as Node | null;
      if (want && t && typeof t.nodeType === "number" && want.contains(t)) setTimeout(go, 80);
    };
    const docs = windowsOf(window).map((w) => w.document);
    for (const d of docs) d.addEventListener(type, on, true);
    return () => {
      for (const d of docs) d.removeEventListener(type, on, true);
    };
  }, [ready, clickAnchor, step.click?.double, go]);

  // Next takes a click step's click for the viewer, so the page moves as it would have.
  const forward = useCallback(() => {
    const el = clickAnchor && findAnchor(clickAnchor);
    if (!el) return go();
    press(el, step.click?.double);
    setTimeout(go, 500);
  }, [clickAnchor, step.click?.double, go]);

  // The viewer's keys, wherever the focus is: a click in a frame takes it there.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // shut's own Escape, which closes what a step opened, isn't the viewer's.
      if (!e.isTrusted || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") forward();
      else if (e.key === "ArrowLeft" && step.index > 0) onBack();
      else if (e.key === "Escape" && !step.needs) onExplore();
    };
    const wins = windowsOf(window);
    for (const w of wins) w.addEventListener("keydown", key);
    return () => {
      for (const w of wins) w.removeEventListener("keydown", key);
    };
    // Again once the step is ready, by when its page's frames have loaded.
  }, [forward, onBack, onExplore, step.index, step.needs, ready]);

  const box = useBox(step.anchor, target);
  const clickBox = useBox(ready ? clickAnchor : undefined, null);
  const lit = box && visibleBox(box, view);
  const hole = lit && {
    left: Math.max(lit.left - PAD, 0),
    top: Math.max(lit.top - PAD, BAR),
    width: lit.width + PAD * 2,
    height: lit.height + PAD * 2,
  };
  const scroller = target && scrollerOf(target);

  return (
    <>
      <Spotlight hole={ready ? hole : null} dimAll={!ready || !hole} onBlocked={() => setNudge((n) => n + 1)} scroller={scroller} />
      {ready && clickBox && visibleBox(clickBox, view) && <Beacon box={clickBox} />}
      {ready && (
        <Card
          step={step}
          total={total}
          chapter={chapter}
          chapters={chapters}
          hole={hole}
          view={view}
          nudge={nudge}
          anchor={step.anchor ? (target ? "found" : "missing") : "none"}
          click={clickAnchor ? (clickFound ? "found" : "missing") : "none"}
          onNext={forward}
          onBack={onBack}
          onExplore={onExplore}
        />
      )}
    </>
  );
}

// Spotlight dims the page but the hole, which the viewer can click through; a click on the dim
// is caught, and nudges the card, while the wheel still scrolls the page under it.
function Spotlight({ hole, dimAll, onBlocked, scroller }: { hole: Box | null; dimAll: boolean; onBlocked: () => void; scroller: HTMLElement | null }) {
  const wheel = (e: WheelEvent) => (scroller ?? document.scrollingElement)?.scrollBy({ top: e.deltaY, left: e.deltaX });
  const block = (style: JSX.CSSProperties, key: string) => (
    <div key={key} class="gd-block" style={style} onClick={onBlocked} onWheel={wheel} onDblClick={onBlocked} />
  );
  if (dimAll || !hole) {
    return <div class="gd-dim gd-dim-all" style={{ top: BAR }} onClick={onBlocked} onWheel={wheel} data-gd="dim" />;
  }
  const top = hole.top - BAR;
  return (
    <div aria-hidden="true" class="gd-dim" style={{ top: BAR }} data-gd="dim">
      <div class="gd-hole" style={{ left: hole.left, top, width: hole.width, height: hole.height }} />
      {block({ left: 0, right: 0, top: 0, height: Math.max(top, 0) }, "t")}
      {block({ left: 0, right: 0, top: top + hole.height, bottom: 0 }, "b")}
      {block({ left: 0, width: Math.max(hole.left, 0), top, height: hole.height }, "l")}
      {block({ left: hole.left + hole.width, right: 0, top, height: hole.height }, "r")}
    </div>
  );
}

// Beacon is Walnut's pulsing marker, on what a click step asks the viewer to click.
function Beacon({ box }: { box: Box }) {
  return (
    <div aria-hidden="true" class="gd-beacon" style={{ left: box.left - 3, top: box.top - 3, width: box.width + 6, height: box.height + 6 }}>
      <span class="gd-beacon-ring" />
      <span class="gd-beacon-dot">
        <span class="gd-ping" />
        <span class="gd-dot" />
      </span>
    </div>
  );
}

function Card({
  step,
  total,
  chapter,
  chapters,
  hole,
  view,
  nudge,
  anchor,
  click,
  onNext,
  onBack,
  onExplore,
}: {
  step: Step;
  total: number;
  chapter: Chapter;
  chapters: number;
  hole: Box | null;
  view: Box;
  nudge: number;
  anchor: "found" | "missing" | "none";
  click: "found" | "missing" | "none";
  onNext: () => void;
  onBack: () => void;
  onExplore: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 352, height: 240 });
  // The card's own size places it, measured once its step is drawn.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r && r.width > 0 && (Math.abs(r.width - size.width) > 1 || Math.abs(r.height - size.height) > 1)) setSize({ width: r.width, height: r.height });
  }, [step.id, nudge, size.width, size.height]);
  const narrow = view.width < 640;
  const p = narrow ? null : place(hole, size, view);
  const last = step.index === total - 1;
  // The arrow points at the hole's middle, along the card's side that faces it.
  const arrow =
    p && hole && p.side !== "inside"
      ? p.side === "left" || p.side === "right"
        ? { top: Math.min(Math.max(hole.top + hole.height / 2 - p.top - 6, 16), size.height - 28) }
        : { left: Math.min(Math.max(hole.left + hole.width / 2 - p.left - 6, 16), size.width - 28) }
      : null;

  return (
    <aside
      ref={ref}
      aria-label="Guided demo"
      aria-live="polite"
      class={cx("gd-card", narrow && "gd-card-narrow")}
      // On a narrow window the card sits across the foot of the view, above any footer it leaves lit.
      style={p ? { left: p.left, top: p.top } : { bottom: window.innerHeight - view.top - view.height + 12 }}
      data-gd="card"
      data-gd-step={step.id}
      data-gd-anchor={anchor}
      data-gd-click={click}
    >
      {arrow && p && p.side !== "inside" && <span aria-hidden="true" class={`gd-arrow gd-arrow-${p.side}`} style={arrow} />}
      <div key={`${step.id}-${nudge}`} class={cx("gd-card-body", nudge > 0 ? "gd-in-left" : "gd-in-up")}>
        <div class="gd-card-head">
          <span class="gd-kicker gd-truncate">
            {step.chapter + 1} of {chapters} · {chapter.title}
          </span>
          <span class="gd-card-count">
            <span class="gd-mono">
              {step.index + 1}/{total}
            </span>
            <button type="button" class="gd-btn gd-btn-ghost gd-btn-icon" aria-label="Explore freely instead" title="Explore freely (Esc)" onClick={onExplore}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        </div>
        <h2 class="gd-card-title">{step.title}</h2>
        <p class="gd-card-text">{step.body}</p>
        {step.click && (
          <p class={cx("gd-hint", nudge > 0 && "gd-hint-nudged")}>
            <MousePointerClick size={16} aria-hidden="true" class="gd-hint-icon" />
            <span>{step.click.hint}</span>
          </p>
        )}
        {nudge > 0 && !step.click && <p class="gd-held">The tour holds the page still. Use Next, or switch to Explore freely to click anywhere.</p>}
        <div class="gd-card-actions">
          <button type="button" class="gd-btn gd-btn-outline gd-btn-sm" disabled={step.index === 0} onClick={onBack} data-gd="back">
            <ChevronLeft size={14} aria-hidden="true" /> Back
          </button>
          <span class="gd-grow" />
          <button type="button" class="gd-btn gd-btn-primary gd-btn-sm" onClick={onNext} data-gd="next">
            {last ? "Finish" : step.click ? "Next: do it for me" : "Next"} <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div aria-hidden="true" class="gd-pips">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} class={cx("gd-pip", i <= step.index && "gd-pip-on")} />
          ))}
        </div>
      </div>
    </aside>
  );
}

// ── Exploring freely ──────────────────────────────────────────────────────────────

// Explore leaves the page to the viewer, with the tour's stops on it as hotspots, as a Walnut
// sandbox demo keeps its hotspots, and a way back into the tour where it was left.
function Explore({ steps, location, at, bottomInset, onGuide }: { steps: Step[]; location: Where; at: number; bottomInset: number; onGuide: (i: number) => void }) {
  const here = useMemo(
    () =>
      steps.filter(
        (s) => s.anchor && !s.needs && decodeURIComponent(new URL(s.to, "https://demo.invalid").pathname) === decodeURIComponent(location.pathname),
      ),
    [steps, location.pathname],
  );
  const [spots, setSpots] = useState<{ step: Step; x: number; y: number }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const view = useViewport(bottomInset);

  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const tick = () => {
      if (frame++ % 6 === 0) {
        const next = here.flatMap((step) => {
          const e = findAnchor(step.anchor!);
          const r = e && screenBox(e);
          if (!r || r.width === 0) return [];
          const x = r.left + r.width - 16;
          const y = r.top + 14;
          return y > view.top && y < view.top + view.height - 8 && x > 0 && x < view.width ? [{ step, x, y }] : [];
        });
        setSpots((prev) =>
          JSON.stringify(prev.map((s) => [s.step.id, s.x, s.y])) === JSON.stringify(next.map((s) => [s.step.id, s.x, s.y])) ? prev : next,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [here, view]);

  const shown = spots.find((s) => s.step.id === open);
  return (
    <>
      {spots.map(({ step, x, y }) => (
        <button
          key={step.id}
          type="button"
          aria-label={`Tour stop: ${step.title}`}
          aria-expanded={open === step.id}
          onClick={() => setOpen((o) => (o === step.id ? null : step.id))}
          class="gd-hotspot"
          style={{ left: x, top: y }}
          data-gd="hotspot"
        >
          <span class="gd-ping" />
          <span class="gd-dot gd-dot-sm" />
        </button>
      ))}
      {shown && (
        <div
          role="dialog"
          aria-label={shown.step.title}
          class="gd-spot gd-pop"
          style={{ left: Math.min(Math.max(shown.x - 288, 12), view.width - 300), top: Math.min(shown.y + 16, view.top + view.height - 200) }}
        >
          <div class="gd-spot-head">
            <h2 class="gd-spot-title">{shown.step.title}</h2>
            <button type="button" class="gd-btn gd-btn-ghost gd-btn-icon" aria-label="Close" onClick={() => setOpen(null)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <p class="gd-spot-text">{shown.step.body}</p>
          <button type="button" class="gd-btn gd-btn-primary gd-btn-sm gd-spot-go" onClick={() => onGuide(shown.step.index)}>
            <Play size={14} aria-hidden="true" /> Take the tour from here
          </button>
        </div>
      )}
      <div class="gd-resume" style={{ bottom: bottomInset + 12 }}>
        <button type="button" class="gd-btn gd-btn-primary gd-btn-sm" onClick={() => onGuide(at)} data-gd="resume-tour">
          <Play size={14} aria-hidden="true" /> {at > 0 ? `Resume the tour · ${at + 1} of ${steps.length}` : "Start the guided tour"}
        </button>
        {at > 0 && (
          <button type="button" class="gd-btn gd-btn-ghost gd-btn-icon" aria-label="Restart the tour" title="Restart the tour" onClick={() => onGuide(0)}>
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}

// ── The welcome and the end ───────────────────────────────────────────────────────

function Overlay({ label, gd, children }: { label: string; gd: string; children: ComponentChildren }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} class="gd-overlay" style={{ top: BAR }} data-gd={gd}>
      <div class="gd-panel gd-pop">{children}</div>
    </div>
  );
}

function Intro({
  chapters,
  text,
  minutes,
  config,
  resume,
  onStart,
  onExplore,
}: {
  chapters: Chapter[];
  text: TourText;
  minutes: number;
  config: DemoConfig;
  resume: Step | undefined;
  onStart: (i: number) => void;
  onExplore: () => void;
}) {
  // Each chapter's first step, counted through the chapters before it.
  const starts = chapters.map((_, i) => chapters.slice(0, i).reduce((n, c) => n + c.steps.length, 0));
  return (
    <Overlay label={`Welcome to the ${text.title}`} gd="welcome">
      <p class="gd-kicker gd-kicker-wide">
        {text.welcome.kicker ?? "Interactive demo"}
        {config.prospect ? ` · prepared for ${config.prospect}` : ""}
      </p>
      <h1 class="gd-panel-title">{text.welcome.heading}</h1>
      <p class="gd-panel-text">{text.welcome.body}</p>
      <ol class="gd-intro-chapters">
        {chapters.map((c, i) => (
          <li key={c.title}>
            <button type="button" onClick={() => onStart(starts[i]!)} class="gd-chapter">
              <span class="gd-num gd-num-accent">{i + 1}</span>
              <span class="gd-chapter-words">
                <span class="gd-chapter-title">{c.title}</span>
                <span class="gd-chapter-blurb gd-truncate">{c.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div class="gd-panel-actions">
        <button type="button" class="gd-btn gd-btn-primary gd-btn-lg" onClick={() => onStart(0)} data-gd="start">
          <Play size={16} aria-hidden="true" /> Start the guided tour
        </button>
        {resume && (
          <button type="button" class="gd-btn gd-btn-outline gd-btn-lg" onClick={() => onStart(resume.index)} data-gd="resume">
            Resume at step {resume.index + 1}
          </button>
        )}
        <button type="button" class="gd-btn gd-btn-ghost gd-btn-lg" onClick={onExplore} data-gd="explore">
          <Hand size={16} aria-hidden="true" /> Explore on my own
        </button>
      </div>
      <p class="gd-panel-foot">About {minutes} minutes · ← and → step through the tour, Esc leaves it to explore</p>
    </Overlay>
  );
}

function Outro({ text, config, onExplore, onRestart }: { text: TourText; config: DemoConfig; onExplore: () => void; onRestart: () => void }) {
  return (
    <Overlay label="The end of the tour" gd="end">
      <p class="gd-kicker gd-kicker-wide">The end of the tour</p>
      <h1 class="gd-panel-title">{text.end.heading ?? "What you saw"}</h1>
      <ul class="gd-points">
        {text.end.points.map((t) => (
          <li key={t}>
            <Check size={16} aria-hidden="true" class="gd-point-icon" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <div class="gd-panel-actions">
        {config.contact && (
          <a href={config.contact.href} target="_blank" rel="noopener noreferrer" class="gd-btn gd-btn-primary gd-btn-lg" data-gd="contact">
            {config.contact.label}
          </a>
        )}
        <button type="button" class={cx("gd-btn gd-btn-lg", config.contact ? "gd-btn-outline" : "gd-btn-primary")} onClick={onExplore}>
          <Hand size={16} aria-hidden="true" /> Explore freely
        </button>
        <button type="button" class="gd-btn gd-btn-ghost gd-btn-lg" onClick={onRestart}>
          <RotateCcw size={16} aria-hidden="true" /> Restart the tour
        </button>
      </div>
    </Overlay>
  );
}
