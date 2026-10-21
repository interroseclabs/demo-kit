// Harbor's crawl: what a click in the demo can ask for that no route opens as it loads. It reads
// the recording so far and prints the paths, for demo-kit fetch to read through the recorder:
//
//   node demo/crawl.mjs recording.json > demo/paths.txt
import { readFileSync } from "node:fs";

const recording = JSON.parse(readFileSync(process.argv[2], "utf8"));
const body = (key) => (recording[key] ? JSON.parse(recording[key].body) : undefined);
const shipments = body("/api/shipments")?.shipments ?? [];
const reports = body("/api/reports")?.reports ?? [];
const paths = [
  ...shipments.flatMap((s) => [`/api/documents/${s.document_id}`, `/api/documents/${s.document_id}/pdf`]),
  ...reports.map((r) => `/api/reports/${r.id}/pdf`),
];
console.log(paths.join("\n"));
