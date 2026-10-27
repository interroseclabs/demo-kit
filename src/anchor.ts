import { visibleBox, type Box } from "./place.js";

// Anchor is where on the page a tour step points: an element the viewer can see, found the way a
// reader finds it, by its accessible name or its words, never by a class name. What the page
// itself doesn't hold is looked for in its same-origin frames, as a viewer sees them as one page;
// an `in` that names a frame looks in the page it holds.
export type Anchor =
  // A <section> by its accessible name: its aria-label, the element it is labelled by, or else
  // its own first heading. Any case.
  | { section: string; in?: Anchor }
  // An element by its aria-label, exactly or by how it starts.
  | { label: string; starts?: true; in?: Anchor }
  // A link, button, tab, table row, menu item, option or summary by its text, exactly or by how
  // it starts, and pressed (aria-pressed="true") where it says so. A row's text is all its cells',
  // so a row is found by how it starts: { text: "SHP-1001", starts: true }.
  | { text: string; starts?: true; pressed?: true; in?: Anchor }
  // An element by a CSS selector, for what has none of those: a table's first row.
  | { selector: string; in?: Anchor };

const CLICKABLE = "a, button, [role='button'], [role='tab'], tr, [role='row'], [role='menuitem'], [role='option'], summary";

// An element of a frame's page is that window's HTMLElement, not this one's.
const isHTML = (e: Element): e is HTMLElement => e instanceof ((e.ownerDocument.defaultView as (Window & typeof globalThis) | null)?.HTMLElement ?? HTMLElement);
const visible = (e: Element): e is HTMLElement => isHTML(e) && e.getClientRects().length > 0;
const words = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

// frameDocument is the page a frame element holds, where it is of this origin, or null.
function frameDocument(e: ParentNode): Document | null {
  const tag = (e as Element).tagName;
  if (tag !== "IFRAME" && tag !== "FRAME") return null;
  try {
    return (e as HTMLIFrameElement).contentDocument;
  } catch {
    return null;
  }
}

// sectionName is a section's accessible name: its aria-label, else the text of the elements its
// aria-labelledby names, else its own first heading's text.
export function sectionName(section: Element): string {
  const label = section.getAttribute("aria-label");
  if (label) return words(label);
  const by = section.getAttribute("aria-labelledby");
  if (by) {
    // The tree it is in, which is the document once the page is on screen. An id from React's
    // useId has colons, so the ids are matched as attributes, not as #id selectors.
    const tree = section.getRootNode() as ParentNode;
    const named = by
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => tree.querySelector(`[id="${id.replace(/["\\]/g, "\\$&")}"]`)?.textContent)
      .filter(Boolean);
    if (named.length > 0) return words(named.join(" "));
  }
  const heading = [...section.querySelectorAll("h1, h2, h3, h4, h5, h6")].find((h) => h.closest("section") === section);
  return words(heading?.textContent);
}

// findSection is the first section under root named name, in any case.
export function findSection(root: ParentNode, name: string): HTMLElement | null {
  const want = name.toLowerCase();
  for (const s of root.querySelectorAll<HTMLElement>("section")) {
    if (sectionName(s).toLowerCase() === want) return s;
  }
  return null;
}

// findAnchor is the element anchor names that is on screen now, or null: on the page first, then
// in its drawn same-origin frames, in the order they come.
export function findAnchor(anchor: Anchor, root: ParentNode = document): HTMLElement | null {
  const scope = anchor.in ? findAnchor(anchor.in, root) : root;
  if (!scope) return null;
  return search(anchor, frameDocument(scope) ?? scope);
}

function search(anchor: Anchor, root: ParentNode): HTMLElement | null {
  const here = findIn(anchor, root);
  if (here) return here;
  for (const f of root.querySelectorAll("iframe, frame")) {
    const doc = visible(f) ? frameDocument(f) : null;
    const there = doc && search(anchor, doc);
    if (there) return there;
  }
  return null;
}

function findIn(anchor: Anchor, scope: ParentNode): HTMLElement | null {
  if ("section" in anchor) {
    const want = anchor.section.toLowerCase();
    return [...scope.querySelectorAll("section")].find((s): s is HTMLElement => sectionName(s).toLowerCase() === want && visible(s)) ?? null;
  }
  if ("label" in anchor) {
    const want = anchor.label;
    return (
      [...scope.querySelectorAll("[aria-label]")].find((e): e is HTMLElement => {
        const label = e.getAttribute("aria-label") ?? "";
        return (anchor.starts ? label.startsWith(want) : label === want) && visible(e);
      }) ?? null
    );
  }
  if ("text" in anchor) {
    const want = anchor.text;
    const found = [...scope.querySelectorAll(CLICKABLE)].filter((e): e is HTMLElement => {
      const text = words(e.textContent);
      if (anchor.pressed && e.getAttribute("aria-pressed") !== "true") return false;
      return (anchor.starts ? text.startsWith(want) : text === want) && visible(e);
    });
    // The innermost: a row whose one cell is a button reads as the button's words too.
    return found.find((e) => !found.some((o) => o !== e && e.contains(o))) ?? null;
  }
  return [...scope.querySelectorAll(anchor.selector)].find(visible) ?? null;
}

// describeAnchor is how an anchor reads in a message: the checker names a step's missing one.
export function describeAnchor(anchor: Anchor): string {
  const own =
    "section" in anchor
      ? `section "${anchor.section}"`
      : "label" in anchor
        ? `label "${anchor.label}"${anchor.starts ? "…" : ""}`
        : "text" in anchor
          ? `text "${anchor.text}"${anchor.starts ? "…" : ""}${anchor.pressed ? " (pressed)" : ""}`
          : `selector ${anchor.selector}`;
  return anchor.in ? `${own} in ${describeAnchor(anchor.in)}` : own;
}

// waitForAnchor is the element anchor names once it is on screen, or null after timeout ms: a step
// is entered as its page loads.
export function waitForAnchor(anchor: Anchor, timeout = 6000, signal?: AbortSignal): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const until = Date.now() + timeout;
    const look = () => {
      if (signal?.aborted) return resolve(null);
      const e = findAnchor(anchor);
      if (e) return resolve(e);
      if (Date.now() > until) return resolve(null);
      setTimeout(look, 80);
    };
    look();
  });
}

// scrollerOf is the nearest ancestor of e that scrolls, or null where the page itself does. Out of
// a frame's page that doesn't scroll, it goes on from the frame.
export function scrollerOf(e: Element, top: Window = window): HTMLElement | null {
  for (let at: Element | null = e; at; ) {
    const win: Window | null = at.ownerDocument.defaultView;
    for (let p = at.parentElement; p; p = p.parentElement) {
      const { overflowY } = (win ?? window).getComputedStyle(p);
      if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) return p;
    }
    if (!win || win === top) return null;
    const page = at.ownerDocument.scrollingElement as HTMLElement | null;
    if (page && page.scrollHeight > page.clientHeight) return page;
    at = win.frameElement;
  }
  return null;
}

// screenBox is where e is in top's window, through the same-origin frames it is in, cut to what
// each frame shows of it; null where none of it shows.
export function screenBox(e: Element, top: Window = window): Box | null {
  const r = e.getBoundingClientRect();
  let box: Box | null = { left: r.left, top: r.top, width: r.width, height: r.height };
  for (let win: Window | null = e.ownerDocument.defaultView; box && win && win !== top && win.frameElement; ) {
    const frame = win.frameElement as HTMLElement;
    const style = (frame.ownerDocument.defaultView ?? window).getComputedStyle(frame);
    const px = (v: string) => parseFloat(v) || 0;
    const f = frame.getBoundingClientRect();
    const left = f.left + frame.clientLeft + px(style.paddingLeft);
    const at = f.top + frame.clientTop + px(style.paddingTop);
    const view = {
      left,
      top: at,
      width: frame.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
      height: frame.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
    };
    box = visibleBox({ ...box, left: box.left + left, top: box.top + at }, view);
    win = frame.ownerDocument.defaultView;
  }
  return box;
}

// windowsOf is win and the window of every same-origin frame in it, a viewer's clicks and keys
// in any of them being on the one page.
export function windowsOf(win: Window): Window[] {
  const out = [win];
  for (const f of win.document.querySelectorAll("iframe, frame")) {
    const doc = frameDocument(f);
    if (doc?.defaultView) out.push(...windowsOf(doc.defaultView));
  }
  return out;
}

// sameRoute is whether the router is at to, the query's order and encoding aside: a step's page,
// and the page a click on the step before took the viewer to, name one page alike.
export function sameRoute(at: { pathname: string; search: string; hash: string }, to: string): boolean {
  const u = new URL(to, "https://demo.invalid");
  const norm = (s: string) =>
    [...new URLSearchParams(s)]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("&");
  return decodeURIComponent(u.pathname) === decodeURIComponent(at.pathname) && norm(u.search) === norm(at.search) && (!u.hash || u.hash === at.hash);
}
