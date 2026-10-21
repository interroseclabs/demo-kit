// Harbor's API: a synthetic shipping estate, the same for the same seed. It answers JSON to a
// client bearing the dev token, and a PDF for each document and report.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8601);
const TOKEN = process.env.HARBOR_TOKEN ?? "dev-token";

// A seeded generator, so every run is the same estate.
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rand() * a.length)];

const PORTS = ["Rotterdam", "Singapore", "Busan", "Santos", "Valencia", "Durban"];
const CARRIERS = ["Northwind Lines", "Bluefin Cargo", "Saltmarsh Shipping"];
const STATUSES = ["in transit", "delayed", "delivered"];
const shipments = Array.from({ length: 36 }, (_, i) => {
  const status = i % 5 === 0 ? "delayed" : pick(STATUSES);
  const from = pick(PORTS);
  let to = pick(PORTS);
  while (to === from) to = pick(PORTS);
  return {
    id: `SHP-${1001 + i}`,
    from,
    to,
    carrier: pick(CARRIERS),
    status,
    containers: 1 + Math.floor(rand() * 40),
    delay_days: status === "delayed" ? 1 + Math.floor(rand() * 9) : 0,
    document_id: `BOL-${5001 + i}`,
  };
});
const reports = [
  { id: "weekly-ops", name: "Weekly operations", pages: 6 },
  { id: "delays", name: "Delays and their causes", pages: 4 },
];

function overview() {
  const by = (s) => shipments.filter((x) => x.status === s).length;
  const delays = PORTS.map((port) => ({ port, delayed: shipments.filter((s) => s.status === "delayed" && s.to === port).length })).filter((p) => p.delayed > 0);
  return {
    company: "Lakeside Freight (synthetic)",
    figures: { shipments: shipments.length, in_transit: by("in transit"), delayed: by("delayed"), delivered: by("delivered"), on_time: Math.round((100 * (shipments.length - by("delayed"))) / shipments.length) },
    delays_by_port: delays.sort((a, b) => b.delayed - a.delayed),
    recent: shipments.slice(0, 5),
  };
}

function pdf(title) {
  // A one-page PDF that says what it is.
  const text = `BT /F1 18 Tf 72 720 Td (${title.replace(/[()\\]/g, "")}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const at = [];
  objs.forEach((o, i) => {
    at.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const routes = [
  [/^\/api\/me$/, () => ({ email: "dana.ops@lakeside.example", name: "Dana Ops" })],
  [/^\/api\/overview$/, () => overview()],
  [/^\/api\/shipments$/, (_m, q) => ({ shipments: shipments.filter((s) => !q.get("status") || s.status === q.get("status")) })],
  [/^\/api\/shipments\/([^/]+)$/, (m) => shipments.find((s) => s.id === m[1]) ?? null],
  [/^\/api\/documents\/([^/]+)$/, (m) => {
    const s = shipments.find((x) => x.document_id === m[1]);
    return s && { id: m[1], shipment: s.id, title: `Bill of lading ${m[1]}`, lines: [`Shipper: ${s.carrier}`, `Port of loading: ${s.from}`, `Port of discharge: ${s.to}`, `Containers: ${s.containers}`] };
  }],
  [/^\/api\/documents\/([^/]+)\/pdf$/, (m) => ({ pdf: `Bill of lading ${m[1]}`, name: `${m[1]}.pdf` })],
  [/^\/api\/reports$/, () => ({ reports })],
  [/^\/api\/reports\/([^/]+)\/pdf$/, (m) => ({ pdf: reports.find((r) => r.id === m[1])?.name, name: `${m[1]}.pdf` })],
];

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body, type = "application/json", extra = {}) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    res.writeHead(status, { "Content-Type": type, "Content-Length": buf.length, ...extra });
    res.end(buf);
  };
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "sign in first" });
  if (req.method !== "GET") return send(201, { saved: true });
  for (const [re, answer] of routes) {
    const m = re.exec(url.pathname);
    if (!m) continue;
    const v = answer(m, url.searchParams);
    if (v == null) return send(404, { error: "not found" });
    if (v.pdf) return send(200, pdf(v.pdf), "application/pdf", { "Content-Disposition": `attachment; filename="${v.name}"` });
    return send(200, v);
  }
  send(404, { error: "not found" });
}).listen(PORT, "127.0.0.1", () => console.log(`Harbor's API on http://127.0.0.1:${PORT}`));
