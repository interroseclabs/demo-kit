// The tour: chapters of steps, their figures read from the recording, so a card never says what
// the page doesn't show. Anchors find what a viewer finds: a section by its accessible name, an
// element by its aria-label, a button or link by its words. A selector is the last resort.
import { readJSON, type Chapter, type Recording } from "@interroseclabs/demo-kit";

const n = (v: number) => v.toLocaleString("en-US");

// estate is how the welcome names the recorded data.
export function estate(recording: Recording): string {
  const company = readJSON<{ name: string }>(recording, "/api/APP-summary")?.name;
  return company ? `${company}, a synthetic estate` : "a synthetic estate";
}

export function chapters(recording: Recording): Chapter[] {
  const summary = readJSON<{ total: number }>(recording, "/api/APP-summary");
  return [
    {
      title: "APP: the first chapter",
      blurb: "APP: what it shows, in a few words",
      steps: [
        {
          id: "overview",
          title: "APP: the step's title",
          // A figure the step quotes is read from the recording, with words that stand without it.
          body: summary ? `${n(summary.total)} APP things, each …` : "Every APP thing, each …",
          to: "/APP-route",
          anchor: { section: "APP section name" },
        },
        {
          id: "open-one",
          title: "APP: one of them",
          body: "APP: what clicking shows.",
          to: "/APP-route",
          anchor: { label: "APP aria-label" },
          // The tour goes on when the viewer clicks the anchor; Next clicks it for them.
          click: { hint: "Click APP." },
        },
      ],
    },
  ];
}
