#!/usr/bin/env node
// demo-kit: record a dev install of an app, package the recording with the app's demo build into
// one HTML page, check that page as its viewer will open it, and film its tour for a website.
// README.md has the method.
import { parseArgs } from "node:util";

const USAGE = `demo-kit <command> [options]

  record   --upstream <url> --recording <file> [--listen 127.0.0.1:8481] [--prefix /api/]
           [--header "Name: value"]... [--pass "POST /api/sign-in"]... [--read "POST /api/query"]...
           [--insecure]
           A proxy in front of a dev install: keeps every GET under --prefix that answers 200,
           and each POST that --read names by its body.
  visit    --origin <dev server> --routes <file> [--hash] [--init <script.js>]
           Opens each route in headless Chrome so the recorder keeps each page's reads.
  fetch    --paths <file> [--via http://127.0.0.1:8481]
           Reads each path through the recorder: what a click can ask for, or check's misses.
           A line "POST /api/query {...}" sends that body.
  package  --recording <file> --build <dir> --out <page.html> [--html demo.html]
           [--prospect <name>] [--contact-url <https:|mailto:>] [--contact-label <words>]
           [--replace FROM=TO]... [--transform <module.mjs>] [--allow-domain <domain>]... [--title <title>]
           Inlines the recording and the demo build into one page that opens from a file.
  check    <page.html> [--routes <file>] [--misses <file>]
           Opens the page from a file in headless Chrome, walks the tour, and fails on anything
           a viewer would trip on. A demo isn't sent until this passes.
  film     <page.html> --out <dir> [--wide] [--quick] [--stills] [--name <file name>]
           [--color token=value]... [--font <file>] [--logo <file>] [--product <name>]
           [--tagline <words>] [--closing <words>] [--heading <words>] [--lede <words>]
           [--contact-url <https:|mailto:>] [--contact-label <words>] [--page-height 900]
           Films the tour, a shot a step, into 2:1 videos for a website (the whole tour and
           each chapter) with timings.json and a reference module; --wide adds a 16:9 film
           with title, chapter and closing cards. --stills writes one still a shot to check
           the framing; --quick films at 1x and 30 fps. Needs ffmpeg.

CHROME names the browser visit, check and film use.`;

const [command, ...rest] = process.argv.slice(2);
const options = {
  upstream: { type: "string" },
  recording: { type: "string" },
  listen: { type: "string" },
  prefix: { type: "string" },
  header: { type: "string", multiple: true },
  pass: { type: "string", multiple: true },
  read: { type: "string", multiple: true },
  insecure: { type: "boolean" },
  origin: { type: "string" },
  routes: { type: "string" },
  hash: { type: "boolean" },
  init: { type: "string" },
  paths: { type: "string" },
  via: { type: "string" },
  build: { type: "string" },
  html: { type: "string" },
  out: { type: "string" },
  prospect: { type: "string" },
  "contact-url": { type: "string" },
  "contact-label": { type: "string" },
  replace: { type: "string", multiple: true },
  transform: { type: "string" },
  "allow-domain": { type: "string", multiple: true },
  title: { type: "string" },
  misses: { type: "string" },
  name: { type: "string" },
  wide: { type: "boolean" },
  quick: { type: "boolean" },
  stills: { type: "boolean" },
  color: { type: "string", multiple: true },
  font: { type: "string" },
  logo: { type: "string" },
  product: { type: "string" },
  tagline: { type: "string" },
  closing: { type: "string" },
  heading: { type: "string" },
  lede: { type: "string" },
  "page-height": { type: "string" },
  help: { type: "boolean", short: "h" },
};

function need(values, ...names) {
  const missing = names.filter((n) => values[n] === undefined);
  if (missing.length > 0) fail(`${command} needs ${missing.map((n) => `--${n}`).join(", ")}`);
}

function fail(message) {
  console.error(`demo-kit: ${message}\n\n${USAGE}`);
  process.exit(2);
}

if (!command || command === "help" || command === "--help" || command === "-h") {
  console.log(USAGE);
  process.exit(0);
}

let parsed;
try {
  parsed = parseArgs({ args: rest, options, allowPositionals: true });
} catch (e) {
  fail(e.message);
}
const { values: v, positionals } = parsed;

try {
  switch (command) {
    case "record": {
      need(v, "upstream", "recording");
      const { record } = await import("../cli/record.mjs");
      await record({ upstream: v.upstream, recording: v.recording, listen: v.listen, prefix: v.prefix, headers: v.header ?? [], pass: v.pass ?? [], reads: v.read ?? [], insecure: v.insecure });
      break;
    }
    case "visit": {
      need(v, "origin", "routes");
      const { visit } = await import("../cli/visit.mjs");
      await visit({ origin: v.origin, routes: v.routes, hash: v.hash, init: v.init });
      break;
    }
    case "fetch": {
      need(v, "paths");
      const { fetchAll } = await import("../cli/fetch.mjs");
      const r = await fetchAll({ via: v.via ?? "http://127.0.0.1:8481", paths: v.paths });
      process.exit(r.failed.length > 0 ? 1 : 0);
      break;
    }
    case "package": {
      need(v, "recording", "build", "out");
      const { packagePage } = await import("../cli/package.mjs");
      await packagePage({
        recording: v.recording,
        build: v.build,
        html: v.html,
        out: v.out,
        prospect: v.prospect,
        contactUrl: v["contact-url"],
        contactLabel: v["contact-label"],
        replace: v.replace ?? [],
        transform: v.transform,
        allowDomain: v["allow-domain"] ?? [],
        title: v.title,
      });
      break;
    }
    case "check": {
      const page = positionals[0];
      if (!page) fail("check needs the page to check");
      const { check } = await import("../cli/check.mjs");
      const r = await check({ page, routes: v.routes, misses: v.misses });
      process.exit(r.ok ? 0 : 1);
      break;
    }
    case "film": {
      const page = positionals[0];
      if (!page) fail("film needs the page to film");
      need(v, "out");
      const { film } = await import("../cli/film.mjs");
      await film({
        page,
        out: v.out,
        name: v.name,
        wide: v.wide,
        quick: v.quick,
        stills: v.stills,
        colors: v.color ?? [],
        font: v.font,
        logo: v.logo,
        product: v.product,
        tagline: v.tagline,
        closing: v.closing,
        heading: v.heading,
        lede: v.lede,
        contactUrl: v["contact-url"],
        contactLabel: v["contact-label"],
        pageHeight: v["page-height"] === undefined ? undefined : Number(v["page-height"]),
      });
      break;
    }
    default:
      fail(`no command ${command}`);
  }
} catch (e) {
  console.error(`demo-kit ${command}: ${e.message}`);
  process.exit(1);
}
