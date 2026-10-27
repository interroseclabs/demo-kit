// Harbor's crawl: what a click in the demo can ask for that no route opens as it loads. It reads
// the recording so far and prints the paths, for demo-kit fetch to read through the recorder:
//
//   node demo/crawl.mjs recording.json > demo/paths.txt
//
// A POST that reads is a line of its own, its body as the app sends it: the report preview's
// By carrier.
import { readFileSync } from "node:fs";

const recording = JSON.parse(readFileSync(process.argv[2], "utf8"));
const body = (key) => (recording[key] ? JSON.parse(recording[key].body) : undefined);
const shipments = body("/api/shipments")?.shipments ?? [];
const reports = body("/api/reports")?.reports ?? [];
const paths = [
  ...shipments.flatMap((s) => [`/api/documents/${s.document_id}`, `/api/documents/${s.document_id}/pdf`]),
  ...reports.map((r) => `/api/reports/${r.id}/pdf`),
  `POST /api/query ${JSON.stringify({ measure: "delayed", by: "carrier" })}`,
];
console.log(paths.join("\n"));
