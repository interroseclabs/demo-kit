import { gunzipSync } from "node:zlib";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import { emailsIn, packagePage, rekey } from "../../cli/package.mjs";

// A demo build as Vite writes one: a page, one script, one stylesheet and an icon.
function build({ scripts = 1 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pkg-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(
    join(dir, "demo.html"),
    `<!doctype html><html><head><title>App</title>
<link rel="icon" type="image/svg+xml" href="./assets/favicon-1.svg" />
<script type="module" crossorigin src="./assets/demo-1.js"></script>
<link rel="stylesheet" crossorigin href="./assets/style-1.css">
</head><body></body></html>`,
  );
  writeFileSync(join(dir, "assets/demo-1.js"), 'console.log("</script>");');
  if (scripts > 1) writeFileSync(join(dir, "assets/chunk-2.js"), "export {}");
  writeFileSync(join(dir, "assets/style-1.css"), "body{color:red}");
  writeFileSync(join(dir, "assets/favicon-1.svg"), "<svg/>");
  return dir;
}

function recording(entries) {
  const dir = mkdtempSync(join(tmpdir(), "rec-"));
  const file = join(dir, "r.json");
  writeFileSync(file, JSON.stringify(entries));
  return file;
}

const read = (page) => {
  const data = /<script type="application\/octet-stream" id="demo-recording">([^<]+)<\/script>/.exec(page)[1];
  const config = JSON.parse(/<script type="application\/json" id="demo-config">([^<]*)<\/script>/.exec(page)[1]);
  return { recorded: JSON.parse(gunzipSync(Buffer.from(data, "base64")).toString()), config };
};

test("inlines the recording, the config, the script, the stylesheet and the icon into one page", () => {
  const dir = build();
  const out = join(dir, "out.html");
  packagePage({
    recording: recording({
      "/api/x?b=2&a=in%20transit": { type: "application/json", body: '{"who":"dana@corp.example.com"}' },
      "/api/me": { type: "application/json", body: '{"email":"dana@lakeside.example"}' },
    }),
    build: dir,
    out,
    prospect: "Acme",
    contactUrl: "https://example.com/book",
    contactLabel: "Book",
    replace: ["dana@corp.example.com=demo@app.example"],
    log: () => {},
  });
  const page = readFileSync(out, "utf8");
  const { recorded, config } = read(page);
  assert.deepEqual(Object.keys(recorded).sort(), ["/api/me", "/api/x?a=in transit&b=2"]);
  assert.equal(recorded["/api/x?a=in transit&b=2"].body, '{"who":"demo@app.example"}');
  assert.deepEqual(config, { prospect: "Acme", contact: { href: "https://example.com/book", label: "Book" } });
  assert.match(page, /<style>body\{color:red\}<\/style>/);
  assert.match(page, /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,/);
  assert.match(page, /<script type="module">console.log\("<\\\/script>"\);<\/script>/);
  assert.doesNotMatch(page, /assets\//);
});

test("refuses a recording with an address at a real-looking domain, unless it is allowed", () => {
  const dir = build();
  const r = recording({ "/api/me": { type: "application/json", body: '{"email":"pat@acme-corp.io"}' } });
  assert.throws(() => packagePage({ recording: r, build: dir, out: join(dir, "o.html"), log: () => {} }), /acme-corp\.io: 1, such as in \/api\/me/);
  packagePage({ recording: r, build: dir, out: join(dir, "o.html"), allowDomain: ["acme-corp.io"], log: () => {} });
});

test("refuses a build of more than one script, and a call to action that isn't a link", () => {
  const r = recording({ "/api/me": { type: "application/json", body: "{}" } });
  const two = build({ scripts: 2 });
  assert.throws(() => packagePage({ recording: r, build: two, out: join(two, "o.html"), log: () => {} }), /2 scripts/);
  const one = build();
  assert.throws(() => packagePage({ recording: r, build: one, out: join(one, "o.html"), contactUrl: "javascript:alert(1)", log: () => {} }), /https: or mailto:/);
});

test("emailsIn passes the domains reserved for examples", () => {
  const found = emailsIn(
    rekey({
      "/a": { type: "application/json", body: "a@example.com b@x.example c@y.test d@z.invalid e@real.io f@real.io" },
      "/b": { type: "application/pdf", body: "ZUByZWFsLmlv", base64: true },
    }),
  );
  assert.deepEqual([...found].map(([d, f]) => [d, f.n]), [["real.io", 2]]);
});
