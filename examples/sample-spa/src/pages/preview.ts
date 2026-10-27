// The report preview's page: a frame of Harbor's own (srcdoc, so of its origin) that reads the
// delays report through POST /api/query, as an embedded dashboard reads a chart's data. Its first
// script asks the demo, where there is one, to answer its reads from the recording too.
export const PREVIEW = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #e4eef0; }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  h2 { margin: 0; font-size: 15px; }
  button { font: inherit; color: #14b8a6; padding: 4px 10px; border: 1px solid #22343b; border-radius: 6px; background: transparent; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 0; border-bottom: 1px solid #22343b; }
  td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<div id="out"></div>
<script>
parent.demoKitReplay?.(window);
const out = document.getElementById("out");
let by = "port";
async function show() {
  const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ measure: "delayed", by }) });
  const data = await res.json();
  if (!res.ok) {
    out.textContent = data.error || "The preview isn't available.";
    return;
  }
  const other = by === "port" ? "carrier" : "port";
  out.innerHTML =
    '<section aria-label="Preview: delays by ' + by + '">' +
    '<div class="head"><h2>Delayed shipments by ' + (by === "port" ? "port of arrival" : "carrier") + '</h2>' +
    '<button type="button" id="other">By ' + other + '</button></div>' +
    '<table>' + data.rows.map((r) => '<tr><td>' + r.name + '</td><td>' + r.count + '</td></tr>').join("") + '</table>' +
    '</section>';
  document.getElementById("other").addEventListener("click", () => {
    by = other;
    show();
  });
}
show();
</script>
</body>
</html>`;
