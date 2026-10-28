import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { mountDemo, RECORDING_ID, startDemo, type Chapter, type DemoOptions, type FrameReplay } from "../../src/index";
import { CONFIG_ID } from "../../src/config";
import { drawFrame, sizeOf } from "./setup";

const chapters: Chapter[] = [
  {
    title: "The Overview",
    blurb: "One page",
    steps: [
      { id: "figures", title: "Where it stands", body: "Every figure.", to: "/overview", anchor: { section: "Headline figures" } },
      {
        id: "delayed",
        title: "The late ones",
        body: "Click through.",
        to: "/overview",
        anchor: { label: "Delayed" },
        click: { hint: "Click Delayed." },
      },
    ],
  },
  {
    title: "The list",
    blurb: "Filtered",
    steps: [{ id: "list", title: "Delayed shipments", body: "Each one.", to: "/shipments", anchor: { section: "Shipments" } }],
  },
];

const text: DemoOptions["text"] = {
  title: "Harbor interactive demo",
  welcome: { heading: "Every shipment", body: "This is Harbor itself." },
  end: { points: ["One", "Two"] },
};

// The app under the tour: a page per route, drawn into the frame's mount as the hash changes.
function app(mount: HTMLElement) {
  const draw = () => {
    const route = location.hash.replace(/^#/, "").split("?")[0];
    mount.innerHTML =
      route === "/shipments"
        ? `<section aria-label="Shipments"><table><tr><td>SHP-1</td></tr></table></section>`
        : `<section aria-label="Headline figures"><a href="#/shipments" aria-label="Delayed">15</a></section>`;
    sizeOf(mount.querySelector("section")!, { left: 100, top: 120, width: 600, height: 200 });
  };
  draw();
  window.addEventListener("hashchange", draw);
  return () => window.removeEventListener("hashchange", draw);
}

const ui = () => document.querySelector(".gd-ui")!.shadowRoot!;
const q = (sel: string) => ui().querySelector<HTMLElement>(sel);
const until = async <T,>(f: () => T | null | undefined, ms = 4000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe("mountDemo", () => {
  it("frames the page: the bar and the tour in a shadow root, the app's element under them", () => {
    const mount = mountDemo({ chapters, text, colors: { accent: "#0f766e" } });
    const frame = document.querySelector<HTMLElement>(".gd-frame")!;
    expect(frame.contains(mount)).toBe(true);
    expect(frame.style.getPropertyValue("--gd-accent")).toBe("#0f766e");
    expect(document.getElementById("demo-kit-styles")).not.toBeNull();
    expect(q('[data-gd="bar"]')?.textContent).toContain("Harbor interactive demo");
    expect((window as unknown as { __demoKit: { steps: { id: string }[] } }).__demoKit.steps.map((s) => s.id)).toEqual(["figures", "delayed", "list"]);
  });

  it("opens on the welcome, which lists the chapters", () => {
    mountDemo({ chapters, text });
    const welcome = q('[data-gd="welcome"]')!;
    expect(welcome.textContent).toContain("Every shipment");
    expect(welcome.textContent).toContain("The Overview");
    expect(welcome.textContent).toContain("The list");
  });

  it("names the prospect and carries the call to action", () => {
    document.body.innerHTML = `<script type="application/json" id="${CONFIG_ID}">${JSON.stringify({ prospect: "Acme", contact: { href: "https://example.com", label: "Book" } })}</script>`;
    mountDemo({ chapters, text });
    expect(q('[data-gd="bar"]')?.textContent).toContain("prepared for Acme");
    expect(q('[data-gd="contact"]')?.getAttribute("href")).toBe("https://example.com");
  });

  it("walks the tour by Next, from the welcome to the end, taking a click step's click", async () => {
    const stop = app(mountDemo({ chapters, text }));
    q('[data-gd="start"]')!.click();

    let card = await until(() => q('[data-gd="card"]'));
    expect(card.dataset.gdStep).toBe("figures");
    expect(card.dataset.gdAnchor).toBe("found");
    expect(location.hash).toBe("#/overview");

    q('[data-gd="next"]')!.click();
    card = await until(() => (q('[data-gd="card"]')?.dataset.gdStep === "delayed" ? q('[data-gd="card"]') : null));
    expect(card.dataset.gdClick).toBe("found");
    expect(card.textContent).toContain("Click Delayed.");

    // Next on a click step clicks the link, which takes the app to the shipments.
    q('[data-gd="next"]')!.click();
    card = await until(() => (q('[data-gd="card"]')?.dataset.gdStep === "list" ? q('[data-gd="card"]') : null));
    expect(location.hash).toBe("#/shipments");
    expect(card.dataset.gdAnchor).toBe("found");
    expect(q('[data-gd="next"]')!.textContent).toContain("Finish");

    q('[data-gd="next"]')!.click();
    const end = await until(() => q('[data-gd="end"]'));
    expect(end.textContent).toContain("One");
    stop();
  });

  it("leaves demo-kit film the tour in full, and the tour's own way into each step, apart from what check reads", async () => {
    const filmed: Chapter[] = [{ ...chapters[0]!, steps: [{ ...chapters[0]!.steps[0]!, film: { zoom: 1.2, label: "Figures" } }, chapters[0]!.steps[1]!] }, chapters[1]!];
    const stop = app(mountDemo({ chapters: filmed, text }));
    type Film = { chapters: Chapter[]; text: DemoOptions["text"]; enter(id: string): Promise<HTMLElement | null>; describe(a: unknown): string };
    const kit = (window as unknown as { __demoKit: { film: Film } }).__demoKit;
    expect(Object.keys(JSON.parse(JSON.stringify(kit)))).toEqual(["version", "steps", "chapters"]);
    expect(kit.film.chapters[0]!.steps[0]!.film).toEqual({ zoom: 1.2, label: "Figures" });
    expect(kit.film.text.title).toBe("Harbor interactive demo");
    expect(kit.film.describe({ section: "Shipments" })).toBe('section "Shipments"');

    // Entered as the tour enters it: its page, then its element, with the tour itself left closed.
    const el = await kit.film.enter("list");
    expect(location.hash).toBe("#/shipments");
    expect(el?.getAttribute("aria-label")).toBe("Shipments");
    expect(q('[data-gd="welcome"]')).not.toBeNull();
    await expect(kit.film.enter("nowhere")).rejects.toThrow("no step nowhere");
    stop();
  });

  it("points at what a same-origin frame on the page holds, and goes on when the viewer clicks in it", async () => {
    const framedChapters: Chapter[] = [
      {
        title: "Preview",
        blurb: "In a frame",
        steps: [
          { id: "port", title: "By port", body: "x", to: "/reports", anchor: { section: "Delays by port" }, click: { on: { text: "By carrier" }, hint: "Click By carrier." } },
          { id: "carrier", title: "By carrier", body: "y", to: "/reports", anchor: { section: "Delays by carrier" } },
        ],
      },
    ];
    const mount = mountDemo({ chapters: framedChapters, text });
    const frame = document.createElement("iframe");
    mount.append(frame);
    sizeOf(frame, { left: 0, top: 44, width: 800, height: 600 });
    Object.defineProperty(frame, "clientWidth", { value: 800 });
    Object.defineProperty(frame, "clientHeight", { value: 600 });
    drawFrame(frame.contentWindow!);
    const doc = frame.contentDocument!;
    doc.body.innerHTML = `<section aria-label="Delays by port"><button>By carrier</button></section>`;
    sizeOf(doc.querySelector("section")!, { left: 20, top: 30, width: 300, height: 100 });
    doc.querySelector("button")!.addEventListener("click", () => {
      doc.body.innerHTML = `<section aria-label="Delays by carrier"></section>`;
    });

    q('[data-gd="start"]')!.click();
    let card = await until(() => q('[data-gd="card"]'));
    expect(card.dataset.gdAnchor).toBe("found");
    expect(card.dataset.gdClick).toBe("found");
    // The hole is where the section is in the page's window: the frame's place plus its own.
    const hole = await until(() => q(".gd-hole"));
    expect([hole.style.left, hole.style.top]).toEqual(["14px", `${74 - 6 - 44}px`]);

    doc.querySelector("button")!.click();
    card = await until(() => (q('[data-gd="card"]')?.dataset.gdStep === "carrier" ? q('[data-gd="card"]') : null));
    expect(card.dataset.gdAnchor).toBe("found");
  });

  it("finds a step's element again when its frame's page is replaced by the next one", async () => {
    // Two steps point at a dialog, each on its own page: the page swaps its frame for the next
    // one's a moment after the route changes, so the next step first finds the outgoing dialog.
    const dialogs: Chapter[] = [
      {
        title: "Dialogs",
        blurb: "Two",
        steps: [
          { id: "one", title: "One", body: "x", to: "/one", anchor: { section: "Dialog" } },
          { id: "two", title: "Two", body: "y", to: "/two", anchor: { section: "Dialog" } },
        ],
      },
    ];
    const mount = mountDemo({ chapters: dialogs, text });
    const page = (at: { left: number; top: number }) => {
      mount.querySelector("iframe")?.remove();
      const frame = document.createElement("iframe");
      mount.append(frame);
      sizeOf(frame, { left: 0, top: 44, width: 800, height: 600 });
      Object.defineProperty(frame, "clientWidth", { value: 800 });
      Object.defineProperty(frame, "clientHeight", { value: 600 });
      drawFrame(frame.contentWindow!);
      frame.contentDocument!.body.innerHTML = `<section aria-label="Dialog"></section>`;
      sizeOf(frame.contentDocument!.querySelector("section")!, { ...at, width: 300, height: 100 });
    };
    page({ left: 20, top: 30 });
    const swap = () => location.hash.startsWith("#/two") && setTimeout(() => page({ left: 200, top: 300 }), 300);
    window.addEventListener("hashchange", swap);

    q('[data-gd="start"]')!.click();
    await until(() => q(".gd-hole"));
    q('[data-gd="next"]')!.click();
    // The hole is over the incoming dialog, not lost with the outgoing one.
    const hole = await until(() => (q(".gd-hole")?.style.left === "194px" ? q(".gd-hole") : null));
    expect(hole.style.top).toBe(`${344 - 6 - 44}px`);
    window.removeEventListener("hashchange", swap);
  });

  it("says when a step's element isn't on the page, for the checker", async () => {
    const stop = app(mountDemo({ chapters: [{ title: "C", blurb: "b", steps: [{ id: "x", title: "X", body: "x", to: "/overview", anchor: { section: "Nowhere" } }] }], text }));
    q('[data-gd="start"]')!.click();
    const card = await until(() => q('[data-gd="card"]'), 9000);
    expect(card.dataset.gdAnchor).toBe("missing");
    stop();
  }, 12000);

  it("explores freely with a way back into the tour, and keeps progress", async () => {
    const stop = app(mountDemo({ chapters, text, storageKey: "t" }));
    q('[data-gd="explore"]')!.click();
    expect((await until(() => q('[data-gd="resume-tour"]'))).textContent).toContain("Start the guided tour");
    q('[data-gd="resume-tour"]')!.click();
    await until(() => q('[data-gd="card"]'));
    q('[data-gd="next"]')!.click();
    await until(() => (q('[data-gd="card"]')?.dataset.gdStep === "delayed" ? true : null));
    expect(JSON.parse(localStorage.getItem("t")!).at).toBe(1);
    stop();
  });

  it("lists the chapters from the bar, and keeps the list open while it is clicked in", async () => {
    mountDemo({ chapters, text });
    const open = ui().querySelector<HTMLElement>('[data-gd="bar"] button[aria-expanded]')!;
    open.click();
    const list = await until(() => q('nav[aria-label="Tour chapters"]'));
    list.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(q('nav[aria-label="Tour chapters"]')).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await until(() => (q('nav[aria-label="Tour chapters"]') ? null : true));
  });
});

describe("startDemo", () => {
  it("answers the page's API from its recording, and a same-origin frame's when its first script asks", async () => {
    const recording = { "/api/me": { type: "application/json", body: '{"name":"Demo"}' } };
    const data = gzipSync(Buffer.from(JSON.stringify(recording))).toString("base64");
    document.body.innerHTML = `<script type="application/octet-stream" id="${RECORDING_ID}">${data}</script>`;
    let mount: HTMLElement | null = null;
    await startDemo({ tour: () => ({ chapters, text }), render: (m) => (mount = m) });
    expect(mount).not.toBeNull();
    expect(await (await fetch("/api/me")).json()).toEqual({ name: "Demo" });

    const frame = document.createElement("iframe");
    document.body.append(frame);
    const win = frame.contentWindow! as Window & typeof globalThis;
    win.fetch = (async () => new Response("native")) as typeof fetch;
    // A frame's script calls it as parent.demoKitReplay; under jsdom the test's window is a copy.
    (window as FrameReplay).demoKitReplay?.(win);
    expect(await (await win.fetch("/api/me")).json()).toEqual({ name: "Demo" });
  });
});
