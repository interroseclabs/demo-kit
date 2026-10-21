// demo-kit fetch: reads each path of a list through the recorder, so the recording holds what a
// click in the demo can ask for and no page opened: the app's own crawl writes the list. A line
// `demo-kit check --misses` wrote reads the request in its brackets.
import { readFileSync } from "node:fs";

import { listOf } from "./chrome.mjs";

// requestOf is the path to read for a line: a missing read's bracketed request, else the line.
export function requestOf(line) {
  const m = /\[(\/[^\]]*)\]\s*$/.exec(line);
  return m ? m[1] : line.split(/\s+/)[0];
}

export async function fetchAll({ via, paths, concurrency = 8, log = console.log }) {
  const list = [...new Set(listOf(readFileSync(paths, "utf8")).map(requestOf))];
  const base = via.replace(/\/$/, "");
  const failed = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < list.length) {
      const path = list[next++];
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(base + path);
          await res.arrayBuffer();
          if (res.status !== 200) failed.push(`${res.status} ${path}`);
          break;
        } catch (e) {
          if (attempt >= 4) {
            failed.push(`no answer ${path}: ${e.message}`);
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
