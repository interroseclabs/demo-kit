// demo-kit visit: opens each route of the app in headless Chrome, against its dev server pointed
// at the recorder, and waits until each has read all it reads as it opens, so the recorder keeps
// every page's own reads.
import { readFileSync } from "node:fs";

import { launch, listOf, settle } from "./chrome.mjs";

export async function visit({ origin, routes, hash = false, init, width = 1440, height = 900, log = console.log }) {
  const list = listOf(readFileSync(routes, "utf8"));
  const page = await launch({ width, height });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  try {
    if (init) await page.send("Page.addScriptToEvaluateOnNewDocument", { source: readFileSync(init, "utf8") });
    const base = origin.replace(/\/$/, "");
    for (const route of list) {
      const to = route.startsWith("/") ? route : `/${route}`;
      await page.navigate(hash ? `${base}/#${to}` : base + to);
      await settle(page);
      log(`visited ${to}`);
    }
  } finally {
    await page.close();
  }
  for (const e of errors.slice(0, 5)) log(`page error: ${e}`);
  return { visited: list.length, errors };
}
