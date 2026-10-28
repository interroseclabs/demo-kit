import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import { fetchAll, parseRequest, requestOf } from "../../cli/fetch.mjs";

test("reads a missing read's request from check's line, or a plain path", () => {
  assert.equal(requestOf("/api/x?a=b/c  [/api/x?a=b%2Fc]"), "/api/x?a=b%2Fc");
  assert.equal(requestOf("/api/documents/BOL-1"), "/api/documents/BOL-1");
});

test("reads a POST that reads from check's line, or from a crawl's, body and all", () => {
  const line = 'POST /api/query?a=b/c 00f3a1b2c3d4e5  [POST /api/query?a=b%2Fc {"by":"carrier","rows":[1,2]}]';
  assert.equal(requestOf(line), 'POST /api/query?a=b%2Fc {"by":"carrier","rows":[1,2]}');
  assert.equal(requestOf('POST /api/query {"by":"port"}'), 'POST /api/query {"by":"port"}');
  assert.deepEqual(parseRequest('POST /api/query {"by":"port"}'), { method: "POST", path: "/api/query", body: '{"by":"port"}' });
  assert.deepEqual(parseRequest("/api/x"), { method: "GET", path: "/api/x", body: undefined });
});

test("sends each read through the recorder, a POST with its body", async () => {
  const seen = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, type: req.headers["content-type"], body });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const dir = mkdtempSync(join(tmpdir(), "fetch-"));
  const paths = join(dir, "paths.txt");
  writeFileSync(paths, ['/api/a', 'POST /api/query {"by":"port"}', '/api/x  [/api/a]'].join("\n"));
  const r = await fetchAll({ via: `http://127.0.0.1:${server.address().port}`, paths, log: () => {} });
  server.close();
  assert.equal(r.read, 2);
  assert.deepEqual(
    seen.sort((a, b) => a.method.localeCompare(b.method)),
    [
      { method: "GET", url: "/api/a", type: undefined, body: "" },
      { method: "POST", url: "/api/query", type: "application/json", body: '{"by":"port"}' },
    ],
  );
});
