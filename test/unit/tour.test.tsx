import { describe, expect, it } from "vitest";

import { mountDemo, type Chapter, type DemoOptions } from "../../src/index";
import { CONFIG_ID } from "../../src/config";
import { sizeOf } from "./setup";

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
