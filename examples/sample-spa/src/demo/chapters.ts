import { readJSON, type Chapter, type Recording } from "@interroseclabs/demo-kit";

import type { Overview, Shipment } from "../api";

const n = (v: number) => v.toLocaleString("en-US");

// company is how the welcome names the recorded estate.
export function company(recording: Recording): string {
  return readJSON<Overview>(recording, "/api/overview")?.company ?? "a synthetic shipping company";
}

// chapters is the walk through the recorded estate, its figures read from the recording, so a
// card never says what the page doesn't show.
export function chapters(recording: Recording): Chapter[] {
  const overview = readJSON<Overview>(recording, "/api/overview");
  const f = overview?.figures;
  const delayed = readJSON<{ shipments: Shipment[] }>(recording, "/api/shipments?status=delayed")?.shipments ?? [];
  const first = delayed[0];
  const worst = overview?.delays_by_port[0];

  return [
    {
      title: "The Overview",
      blurb: "The whole operation on one page",
      steps: [
        {
          id: "figures",
          title: "Where every shipment stands",
          body: f
            ? `${n(f.shipments)} shipments: ${n(f.in_transit)} in transit, ${n(f.delayed)} delayed, ${n(f.delivered)} delivered. ${f.on_time}% are on time.`
            : "How many shipments are in transit, delayed and delivered, and how many are on time.",
          to: "/overview",
          anchor: { section: "Headline figures" },
        },
        {
          id: "delays",
          title: "Where the delays are",
          body: worst ? `${worst.port} has the most delayed shipments arriving: ${n(worst.delayed)}.` : "The ports with delayed shipments arriving, most first.",
          to: "/overview",
          anchor: { section: "Delays by port" },
        },
      ],
    },
    {
      title: "Find the late ones",
      blurb: "From a figure to its shipments",
      steps: [
        {
          id: "delayed-figure",
          title: "Every figure opens its shipments",
          body: "Each count on the Overview is a link to the shipments it counts.",
          to: "/overview",
          anchor: { label: "Delayed", starts: true },
          click: { hint: "Click Delayed." },
        },
        {
          id: "delayed-list",
          title: f ? `The ${n(f.delayed)} delayed shipments` : "The delayed shipments",
          body: "The list filtered to delayed, with each one's route, carrier and how late it is.",
          to: "/shipments?status=delayed",
          anchor: { section: "Shipments table" },
          click: first ? { on: { selector: "tr.clickable" }, hint: `Click ${first.id} to open it.` } : undefined,
        },
        {
          id: "shipment",
          title: first ? `${first.id}, ${first.delay_days} days late` : "One shipment",
          body: first ? `${first.carrier}, ${first.from} to ${first.to}, ${n(first.containers)} containers.` : "Its route, carrier and containers.",
          to: "/shipments?status=delayed",
          anchor: first ? { label: `Shipment ${first.id}` } : undefined,
          needs: first ? { open: { label: `Shipment ${first.id}` }, by: { selector: "tr.clickable" } } : undefined,
          click: first ? { on: { text: "Open the bill of lading" }, hint: "Click Open the bill of lading." } : undefined,
        },
      ],
    },
    {
      title: "The paperwork",
      blurb: "Bills of lading and reports",
      steps: [
        {
          id: "document",
          title: "The bill of lading",
          body: "The shipment's own document, as the carrier issued it, and its PDF to download.",
          to: first ? `/documents/${first.document_id}` : "/reports",
          anchor: { section: "Bill of lading" },
        },
        {
          id: "reports",
          title: "Reports",
          body: "The weekly operations report and the delays report, each a PDF that downloads here.",
          to: "/reports",
          anchor: { section: "Issued reports" },
        },
      ],
    },
  ];
}
