import type { Anchor } from "./anchor.js";

// TourStep is one stop of the guided tour: a page, what on it the card points at, and what the
// viewer reads there. A step with click goes on once the viewer clicks what it names, as Walnut's
// and Navattic's click-through tours do; Next takes the click for them.
export type TourStep = {
  // Unique across the tour: progress is kept by it.
  id: string;
  title: string;
  body: string;
  // The page the step is on, as the app's router routes it: "/projects/p1?tab=tasks".
  to: string;
  // What the card points at; without one it sits over the page's lower right.
  anchor?: Anchor;
  // What the viewer clicks to go on, and the words that ask them to. Without on, the anchor.
  click?: { on?: Anchor; double?: true; hint: string };
  // What must be open for the anchor to show, and the click that opens it: a dialog, an inspector,
  // a toggle. Entered by Back or from the chapter list, the tour clicks it itself.
  needs?: { open: Anchor; by: Anchor; double?: true };
  // How `demo-kit film` films the step, where its own framing isn't the one wanted.
  film?: FilmHints;
};

// FilmHints steer the camera, the page and the callout in a step's shot of `demo-kit film`. The
// film is 1440 px wide; positions are in the page's px at that width.
export type FilmHints = {
  // How close the camera comes, 1 showing the page's whole width. By default as close as leaves
  // the step's element half the frame, from 1 to 1.6.
  zoom?: number;
  // The point of the page the camera centres on, [x, y]; the step's element by default.
  center?: [number, number];
  // Where the element's scrolling container ends up, in px from its top; by default it scrolls
  // the element into view as the tour does.
  scroll?: number;
  // Where the callout sits: beside the element, inside its corner, or in the frame's corner. By
  // default the first side with room, below, above, right, then left.
  place?: FilmPlace;
  // How long the callout stays, in seconds; by default as long as its words take to read.
  hold?: number;
  // The step's name on the website module's step bar, a word or two; its title by default.
  label?: string;
  // Clicks the film shows on the way into the step, from where the step before left the page:
  // the menu a viewer would open, where the tour's Next goes straight to the step's page.
  via?: Anchor[];
  // Leave the step out of the film. It is still entered and its click still taken, so the next
  // step starts where the tour would.
  skip?: true;
};

export type FilmPlace =
  | "below"
  | "above"
  | "right"
  | "left"
  | "below-left"
  | "below-right"
  | "above-left"
  | "above-right"
  | "inside-top-left"
  | "inside-top-right"
  | "inside-bottom-left"
  | "inside-bottom-right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

// Chapter is a run of steps the chapter list names, with a line on what it shows.
export type Chapter = { title: string; blurb: string; steps: TourStep[] };

// Where is a router's location, as the tour reads it.
export type Where = { pathname: string; search: string; hash: string };

// TourRouter is how the tour moves the app between pages and knows where it is. hashRouter fits
// any router that routes by the URL's hash; an app can pass its own router's.
export type TourRouter = {
  navigate(to: string): unknown;
  location(): Where;
  subscribe(on: () => void): () => void;
};
