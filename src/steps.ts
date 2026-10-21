import type { Anchor } from "./anchor";

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
};

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
