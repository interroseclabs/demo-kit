import { render } from "preact";

import { describeAnchor, findAnchor, screenBox } from "./anchor.js";
import { readConfig, type DemoConfig } from "./config.js";
import { installReplay, readRecording, type Recording, type ReplayOptions } from "./replay.js";
import { hashRouter } from "./router.js";
import type { Chapter, TourRouter } from "./steps.js";
import { LIGHT, SHADOW } from "./styles.js";
import { DemoTour, enterStep, press, type TourText } from "./tour.js";

export { describeAnchor, findAnchor, findSection, sameRoute, screenBox, sectionName, waitForAnchor, windowsOf, type Anchor } from "./anchor.js";
export { CONFIG_ID, readConfig, type DemoConfig } from "./config.js";
export { place, visibleBox, type Box, type Placement, type Side } from "./place.js";
export {
  answer,
  bodyHash,
  bytes,
  DEMO_ORIGIN,
  downloadName,
  installReplay,
  json,
  lookup,
  MISSING,
  ownURL,
  readJSON,
  readRecording,
  RECORDING_ID,
  recordingKey,
  recordingKeyOf,
  replayXHR,
  type BodyRead,
  type Handler,
  type Recorded,
  type Recording,
  type ReplayOptions,
} from "./replay.js";
export { hashRouter, whereInHash } from "./router.js";
export type { Chapter, FilmHints, FilmPlace, TourRouter, TourStep, Where } from "./steps.js";
export type { TourText } from "./tour.js";

export const VERSION = "0.1.1";

// The tour's colour tokens, as --gd-<token> on .gd-frame: accent and accent-fg are its brand
// colour and the text on it; bg, surface, fg, muted, muted-fg and border its panels and words;
// font its typeface, the app's own by default.
export type ColorToken = "accent" | "accent-fg" | "bg" | "surface" | "fg" | "muted" | "muted-fg" | "border" | "dim" | "font";

export type DemoOptions = {
  chapters: Chapter[];
  text: TourText;
  // How the tour moves the app; hashRouter by default.
  router?: TourRouter;
  // Who this copy is for and its call to action; read from the page by default.
  config?: DemoConfig;
  // What the dim leaves uncovered at the window's foot, such as the app's own status bar, in px.
  bottomInset?: number;
  // Where the viewer's progress is kept; one key per demo, so two demos don't share it.
  storageKey?: string;
  // The tour's colours: a base theme, and any token set to the app's own. A stylesheet can set the
  // same tokens on .gd-frame instead.
  theme?: "dark" | "light";
  colors?: Partial<Record<ColorToken, string>>;
  // Where the frame goes; the body by default.
  container?: HTMLElement;
};

// mountDemo frames the page for the demo: the bar and the tour, drawn by the kit itself, and
// under them the element the app renders into, which it returns. The app's own fixed elements
// sit in that element, below the bar, as they sit in the window.
export function mountDemo(options: DemoOptions): HTMLElement {
  const doc = document;
  for (const e of [doc.documentElement, doc.body]) {
    e.style.height = "100%";
    e.style.margin = "0";
    e.style.overflow = "hidden";
  }
  const div = (cls: string) => {
    const e = doc.createElement("div");
    e.className = cls;
    return e;
  };
  if (!doc.getElementById("demo-kit-styles")) {
    const light = doc.createElement("style");
    light.id = "demo-kit-styles";
    light.textContent = LIGHT;
    doc.head.prepend(light);
  }
  const frame = div("gd-frame");
  frame.dataset.gdTheme = options.theme ?? "dark";
  for (const [token, value] of Object.entries(options.colors ?? {})) frame.style.setProperty(`--gd-${token}`, value);
  // The bar and the tour are drawn in a shadow root, where no stylesheet of the app's reaches them
  // and none of their elements is found by a step's anchor.
  const ui = div("gd-ui");
  const shadow = ui.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = SHADOW;
  const root = doc.createElement("div");
  shadow.append(style, root);
  const app = div("gd-app");
  const mount = div("gd-mount");
  app.append(mount);
  frame.append(ui, app);
  (options.container ?? doc.body).append(frame);

  const router = options.router ?? hashRouter();
  const steps = options.chapters.flatMap((c, chapter) => c.steps.map((s) => ({ id: s.id, title: s.title, chapter, to: s.to, anchor: Boolean(s.anchor), needs: Boolean(s.needs) })));
  // What `demo-kit check` reads to know the tour it walks.
  const kit = { version: VERSION, steps, chapters: options.chapters.map((c) => c.title) };
  // What `demo-kit film` drives the page by: the tour in full, and the tour's own ways to enter a
  // step and to find and click what an anchor names, with the tour itself left closed. Not
  // enumerable, so the tour as check reads it stays plain data.
  const tour = options.chapters.flatMap((c) => c.steps);
  Object.defineProperty(kit, "film", {
    value: {
      chapters: options.chapters,
      text: options.text,
      enter: (id: string) => {
        const i = tour.findIndex((s) => s.id === id);
        return i < 0 ? Promise.reject(new Error(`no step ${id}`)) : enterStep(router, tour[i]!, tour[i - 1]);
      },
      find: findAnchor,
      describe: describeAnchor,
      box: screenBox,
      press,
    },
  });
  (window as unknown as { __demoKit: unknown }).__demoKit = kit;
  render(
    <DemoTour
      router={router}
      chapters={options.chapters}
      config={options.config ?? readConfig()}
      text={options.text}
      bottomInset={options.bottomInset ?? 0}
      storageKey={options.storageKey ?? `demo-kit:${options.text.title}`}
    />,
    root,
  );
  return mount;
}

export type StartOptions = {
  replay?: ReplayOptions;
  // The tour, made from the recording: its chapters read their figures from it.
  tour: (recording: Recording) => DemoOptions;
  // Renders the app into mount, routed by the URL's hash.
  render: (mount: HTMLElement, recording: Recording) => void;
};

// FrameReplay is what startDemo leaves on the page for its same-origin frames: a frame of the
// app's that reads its API (a srcdoc, an embedded dashboard built into the page) has its first
// script call parent.demoKitReplay?.(window), so its reads are answered from the recording too.
export type FrameReplay = { demoKitReplay?: (win: Window) => void };

// startDemo is a demo page's whole start: it reads the recording the page carries, answers the
// app's API from it, frames the page with the tour, and renders the app in the frame. A page that
// can't start says why, in place of the app.
export async function startDemo(options: StartOptions): Promise<void> {
  try {
    const recording = await readRecording();
    installReplay(recording, options.replay);
    (window as FrameReplay).demoKitReplay = (win) => installReplay(recording, options.replay, win as Window & typeof globalThis);
    const mount = mountDemo(options.tour(recording));
    options.render(mount, recording);
  } catch (err) {
    const p = document.createElement("p");
    p.setAttribute("data-gd", "failed");
    p.style.cssText = "font: 14px/1.5 system-ui, sans-serif; padding: 2rem; max-width: 40rem";
    p.textContent = `The demo couldn't start: ${err instanceof Error ? err.message : String(err)} Open it in a current version of Chrome, Edge, Safari or Firefox.`;
    document.body.append(p);
    console.error(err);
  }
}
