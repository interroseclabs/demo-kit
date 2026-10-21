// Anchor is where on the page a tour step points: an element the viewer can see, found the way a
// reader finds it, by its accessible name or its words, never by a class name.
export type Anchor =
  // A <section> by its accessible name: its aria-label, the element it is labelled by, or else
  // its own first heading. Any case.
  | { section: string; in?: Anchor }
  // An element by its aria-label, exactly or by how it starts.
  | { label: string; starts?: true; in?: Anchor }
  // A link, button, tab, row or summary by its text, exactly or by how it starts, and pressed
  // (aria-pressed="true") where it says so.
  | { text: string; starts?: true; pressed?: true; in?: Anchor }
  // An element by a CSS selector, for what has none of those: a table's first row.
  | { selector: string; in?: Anchor };

const CLICKABLE = "a, button, [role='button'], [role='tab'], [role='row'], [role='menuitem'], [role='option'], summary";

const visible = (e: Element): e is HTMLElement => e instanceof HTMLElement && e.getClientRects().length > 0;
const words = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

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

// findAnchor is the element anchor names that is on screen now, or null.
export function findAnchor(anchor: Anchor, root: ParentNode = document): HTMLElement | null {
  const scope = anchor.in ? findAnchor(anchor.in, root) : root;
  if (!scope) return null;
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
    return (
      [...scope.querySelectorAll(CLICKABLE)].find((e): e is HTMLElement => {
        const text = words(e.textContent);
        if (anchor.pressed && e.getAttribute("aria-pressed") !== "true") return false;
        return (anchor.starts ? text.startsWith(want) : text === want) && visible(e);
      }) ?? null
    );
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

// scrollerOf is the nearest ancestor of e that scrolls, or null where the page itself does.
export function scrollerOf(e: Element): HTMLElement | null {
  for (let p = e.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
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
