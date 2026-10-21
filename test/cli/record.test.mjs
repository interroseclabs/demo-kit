import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

import { passes, startRecorder } from "../../cli/record.mjs";

let upstream;
let seen = [];
const port = () => 21000 + Math.floor(Math.random() * 9000);

before(async () => {
  upstream = createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, cookie: req.headers.cookie });
    if (req.url === "/api/file") {
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="f.pdf"' });
      return res.end(Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff]));
    }
    if (req.url === "/api/gone") {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end('{"error":"gone"}');
    }
    if (req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "s=1" });
      return res.end('{"signed_in":true}');
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ url: req.url }));
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
});
after(() => upstream.close());

test("keeps every 200 GET under the prefix, and nothing else", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rec-"));
  const recording = join(dir, "r.json");
  const listen = `127.0.0.1:${port()}`;
  const rec = await startRecorder({
    upstream: `http://127.0.0.1:${upstream.address().port}`,
    recording,
    listen,
    headers: ["Authorization: Bearer dev-token"],
    pass: ["POST /api/sign-in"],
    log: () => {},
  });
  seen = [];
  const via = `http://${listen}`;
  assert.deepEqual(await (await fetch(`${via}/api/x?b=2&a=1`, { headers: { Cookie: "c=1" } })).json(), { url: "/api/x?b=2&a=1" });
  await (await fetch(`${via}/api/file`)).arrayBuffer();
  assert.equal((await fetch(`${via}/api/gone`)).status, 404);
  await (await fetch(`${via}/index.html`)).text();

  // A change is refused and never reaches the install; a passed one goes through unrecorded.
  const refused = await fetch(`${via}/api/shipments`, { method: "POST", body: "{}" });
  assert.equal(refused.status, 403);
  const signed = await fetch(`${via}/api/sign-in`, { method: "POST", body: "{}" });
  assert.equal(signed.status, 200);
  assert.equal(signed.headers.get("set-cookie"), "s=1");
  await rec.close();

  assert.ok(seen.every((s) => s.auth === "Bearer dev-token"), "every request carries the --header");
  assert.equal(seen[0].cookie, "c=1", "the browser's own cookie goes through");
  assert.ok(!seen.some((s) => s.url === "/api/shipments"), "the refused POST never reached the install");
  const kept = JSON.parse(readFileSync(recording, "utf8"));
  assert.deepEqual(Object.keys(kept).sort(), ["/api/file", "/api/x?b=2&a=1"]);
  assert.equal(kept["/api/x?b=2&a=1"].type, "application/json; charset=utf-8");
  assert.equal(kept["/api/file"].base64, true);
  assert.equal(Buffer.from(kept["/api/file"].body, "base64").at(-1), 0xff);
  assert.equal(kept["/api/file"].disposition, 'attachment; filename="f.pdf"');
});

test("adds to a recording that exists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rec-"));
  const recording = join(dir, "r.json");
  const first = { "/api/old": { type: "application/json", body: "{}" } };
  (await import("node:fs")).writeFileSync(recording, JSON.stringify(first));
  const listen = `127.0.0.1:${port()}`;
  const rec = await startRecorder({ upstream: `http://127.0.0.1:${upstream.address().port}`, recording, listen, log: () => {} });
  await (await fetch(`http://${listen}/api/new`)).text();
  await rec.close();
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(recording, "utf8"))), ["/api/new", "/api/old"]);
});

test("passes names a method and a path prefix", () => {
  assert.equal(passes(["POST /api/sign-in"], "POST", "/api/sign-in?next=/"), true);
  assert.equal(passes(["POST /api/sign-in"], "DELETE", "/api/sign-in"), false);
  assert.equal(passes([], "POST", "/api/x"), false);
});
