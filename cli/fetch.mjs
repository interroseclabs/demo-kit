// demo-kit fetch: reads each path of a list through the recorder, so the recording holds what a
// click in the demo can ask for and no page opened: the app's own crawl writes the list. A line
// `demo-kit check --misses` wrote reads the request in its brackets. A POST that reads is a line
// of its own, "POST /api/query {...}", its body as sent, on one line.
import { readFileSync } from "node:fs";

import { listOf } from "./chrome.mjs";

// requestOf is the request to make for a line: a missing read's bracketed request, else the line.
export function requestOf(line) {
  const m = /\s\s\[((?:[A-Z]+ )?\/.*)\]\s*$/.exec(line);
  if (m) return m[1];
  return /^[A-Z]+ \//.test(line.trim()) ? line.trim() : line.split(/\s+/)[0];
}

// parseRequest is a request's method, path and body: "POST /api/query {...}", or a path to GET.
export function parseRequest(text) {
  const m = /^([A-Z]+) (\S+)(?: (.*))?$/.exec(text);
  return m ? { method: m[1], path: m[2], body: m[3] ?? "" } : { method: "GET", path: text, body: undefined };
}

const isJSON = (s) => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

export async function fetchAll({ via, paths, concurrency = 8, log = console.log }) {
  const list = [...new Set(listOf(readFileSync(paths, "utf8")).map(requestOf))];
  const base = via.replace(/\/$/, "");
  const failed = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < list.length) {
      const text = list[next++];
      const { method, path, body } = parseRequest(text);
      const init = method === "GET" ? undefined : { method, body, headers: { "Content-Type": isJSON(body) ? "application/json" : "text/plain;charset=UTF-8" } };
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(base + path, init);
          await res.arrayBuffer();
          if (res.status !== 200 && !(method !== "GET" && res.status === 201)) failed.push(`${res.status} ${text}`);
          break;
        } catch (e) {
          if (attempt >= 4) {
            failed.push(`no answer ${text}: ${e.message}`);
            break;
          }
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      done++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  for (const f of failed) log(f);
  log(`read ${done} paths through ${base}; ${failed.length} didn't answer 200`);
  return { read: done, failed };
}
