// demo-kit package: keys the recording as the demo's replay looks it up, and inlines it, gzipped,
// with the demo build's one script, its stylesheet and its icon, into one page that opens from a
// file. It refuses a recording that holds an email address outside the reserved example domains,
// unless --allow-domain names its domain: a recording is meant to be of synthetic data only, and
// anyone the page is sent to can read all of it.
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { CONFIG_ID } from "../dist/config.js";
import { RECORDING_ID, recordingKeyOf } from "../dist/replay.js";

// Domains no real person's address is at (RFC 2606, RFC 6761).
const RESERVED = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
// The size above which a page won't go as most email attachments.
const EMAIL_LIMIT = 20e6;

// emailsIn is every email address in the recording's text at a domain not reserved or allowed:
// domain → { n, where }.
export function emailsIn(recording, allowed = []) {
  const ok = (d) => RESERVED.test(d) || allowed.some((a) => d.toLowerCase() === a.toLowerCase() || d.toLowerCase().endsWith(`.${a.toLowerCase()}`));
  const found = new Map();
  for (const [key, r] of Object.entries(recording)) {
    if (r.base64) continue;
    for (const m of r.body.matchAll(EMAIL)) {
      const domain = m[1].replace(/\.$/, "");
      if (ok(domain)) continue;
      const f = found.get(domain) ?? { n: 0, where: key };
      f.n++;
      found.set(domain, f);
    }
  }
  return found;
}

// rekey keys a recording, as `demo-kit record` keeps it, by recordingKey, and applies each
// replacement to every text body.
export function rekey(raw, replace = []) {
  const pairs = replace.map((r) => {
    const at = r.indexOf("=");
    if (at <= 0) throw new Error(`--replace "${r}" isn't FROM=TO`);
    return [r.slice(0, at), r.slice(at + 1)];
  });
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const entry = { ...v };
    if (!entry.base64) for (const [from, to] of pairs) entry.body = entry.body.split(from).join(to);
    out[recordingKeyOf(k)] = entry;
  }
  return out;
}

// A script's text can't hold "</script", which would end its element early, nor "<!--", after
// which a "<script" in it keeps "</script>" from ending it at all. In a script both only occur in
// strings, regular expressions and comments, where the escapes read the same.
const scriptSafe = (s) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\u0021--");

export async function packagePage({ recording, build, html = "demo.html", out, prospect, contactUrl, contactLabel = "Talk to us", replace = [], transform, allowDomain = [], title, log = console.log }) {
  let keyed = rekey(JSON.parse(readFileSync(recording, "utf8")), replace);
  // An app's own change to what it recorded, such as the version its status bar shows: a module
  // whose default export takes the keyed recording and returns it.
  if (transform) keyed = (await (await import(pathToFileURL(resolve(transform)).href)).default(keyed)) ?? keyed;
  if (Object.keys(keyed).length === 0) throw new Error(`${recording} holds no responses: record the app first`);

  const people = emailsIn(keyed, allowDomain);
  if (people.size > 0) {
    const lines = [...people].map(([d, f]) => `  ${d}: ${f.n}, such as in ${f.where}`);
    throw new Error(
      `the recording holds email addresses at domains that aren't reserved for examples:\n${lines.join("\n")}\n` +
        "Record synthetic data only. Replace a signed-in user's address with --replace real@x.com=demo@app.example, " +
        "or, for a synthetic domain, say so with --allow-domain <domain>.",
    );
  }

  // The build: one page, one script, one stylesheet at most, and nothing else it loads.
  const files = walk(build);
  const scripts = files.filter((f) => /\.m?js$/.test(f));
  if (scripts.length !== 1) {
    throw new Error(`${build} has ${scripts.length} scripts (${scripts.join(", ")}); a page opened from a file loads only one. Build with demoBuild() from @interroseclabs/demo-kit/vite.`);
  }
  let page = readFileSync(join(build, html), "utf8");
  if (contactUrl && !/^(https:|mailto:)/i.test(contactUrl)) throw new Error(`--contact-url must be an https: or mailto: link, not ${contactUrl}`);

  const data = gzipSync(Buffer.from(JSON.stringify(keyed)), { level: 9 }).toString("base64");
  const config = {};
  if (prospect) config.prospect = prospect;
  if (contactUrl) config.contact = { href: contactUrl, label: contactLabel };

  const local = (href) => !/^(data:|https?:|\/\/)/i.test(href);
  const asset = (href) => join(build, href.replace(/^\.?\//, "").split(/[?#]/)[0]);
  let inlined = { script: 0, style: 0, icon: 0 };

  page = page.replace(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/g, (all, _a, src) => {
    if (!local(src)) throw new Error(`${html} loads a script from ${src}: a demo loads nothing from the network`);
    inlined.script++;
    const js = scriptSafe(readFileSync(asset(src), "utf8"));
    return (
      `<script type="application/octet-stream" id="${RECORDING_ID}">${data}</script>\n` +
      `<script type="application/json" id="${CONFIG_ID}">${scriptSafe(JSON.stringify(config))}</script>\n` +
      `<script type="module">${js}</script>`
    );
  });
  page = page.replace(/<link\b[^>]*>/g, (tag) => {
    const rel = /\brel="([^"]+)"/.exec(tag)?.[1] ?? "";
    const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
    if (!href || !local(href)) return tag;
    if (/\bstylesheet\b/.test(rel)) {
      inlined.style++;
      return `<style>${readFileSync(asset(href), "utf8").replace(/<\/style/gi, "<\\/style")}</style>`;
    }
    if (/\bicon\b/.test(rel)) {
      inlined.icon++;
      const type = MIME[extname(asset(href)).toLowerCase()] ?? "image/png";
      return `<link rel="icon" type="${type}" href="data:${type};base64,${readFileSync(asset(href)).toString("base64")}" />`;
    }
    if (/\bmodulepreload\b|\bpreload\b|\bmanifest\b/.test(rel)) return "";
    throw new Error(`${html} links ${href} (rel="${rel}"), which a page opened from a file can't load`);
  });
  if (inlined.script !== 1) throw new Error(`${html} has ${inlined.script} script tags with a src; a demo build has one`);
  if (title) page = page.replace(/<title>[^<]*<\/title>/, `<title>${title.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</title>`);

  const left = [...page.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]);
  if (left.length > 0) throw new Error(`the page still loads ${left.join(", ")}: inline every asset (demoBuild() sets assetsInlineLimit)`);
  const unused = files.filter((f) => f !== html && !scripts.includes(f) && !/\.(css|map)$/.test(f) && !/(icon|favicon)/i.test(f));
  for (const f of unused) log(`not in the page: ${f}. If the app loads it at runtime, inline it or record it.`);

  writeFileSync(out, page);
  const size = statSync(out).size;
  log(`${out}: ${(size / 1e6).toFixed(1)} MB, ${Object.keys(keyed).length} recorded responses${prospect ? `, for ${prospect}` : ""}${contactUrl ? `, calling to ${contactUrl}` : ""}`);
  if (size > EMAIL_LIMIT) log(`at ${(size / 1e6).toFixed(0)} MB it is too big for most email: share it as a link, or record less`);
  return { out, size, responses: Object.keys(keyed).length };
}

function walk(dir, root = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), root) : [relative(root, join(dir, e.name))]));
}
