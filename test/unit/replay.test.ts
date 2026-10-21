import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

import {
  answer,
  DEMO_ORIGIN,
  downloadName,
  installReplay,
  json,
  MISSING,
  ownURL,
  readJSON,
  readRecording,
  RECORDING_ID,
  recordingKey,
  replayXHR,
  type Recording,
} from "../../src/replay";

const recording: Recording = {
  "/api/shipments?status=in transit": { type: "application/json", body: '{"page":"filtered"}' },
  "/api/me": { type: "application/json", body: '{"email":"demo@app.example"}' },
  "/api/reports/r1/pdf": { type: "application/pdf", body: btoa("%PDF-1.7"), base64: true, disposition: 'attachment; filename="weekly.pdf"' },
};

const get = (path: string, init?: RequestInit) => answer(recording, new Request(`${DEMO_ORIGIN}${path}`, init));

describe("recordingKey", () => {
  it("decodes the path and sorts the query, so neither encoding nor order matters", () => {
    const a = recordingKey(new URL(`${DEMO_ORIGIN}/api/x%3Ay?b=2&a=in%20transit`));
    expect(a).toBe("/api/x:y?a=in transit&b=2");
    expect(recordingKey(new URL(`${DEMO_ORIGIN}/api/x:y?a=in+transit&b=2`))).toBe(a);
  });

  it("is the bare path without a query", () => {
    expect(recordingKey(new URL(`${DEMO_ORIGIN}/api/me`))).toBe("/api/me");
  });
});

describe("answer", () => {
  it("answers a recorded GET with its body and type", async () => {
    const res = get("/api/shipments?status=in%20transit");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual({ page: "filtered" });
  });

  it("answers a recorded file as its bytes, named as the install named it", async () => {
    const res = get("/api/reports/r1/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="weekly.pdf"');
    expect(await res.text()).toBe("%PDF-1.7");
  });

  it("says what isn't in the demo, rather than inventing it, and logs the read for the checker", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = get("/api/shipments/SHP-9?x=a%2Fb");
    expect(res.status).toBe(404);
    expect(warn).toHaveBeenCalledWith(`${MISSING}/api/shipments/SHP-9?x=a/b  [/api/shipments/SHP-9?x=a%2Fb]`);
    warn.mockRestore();
  });

  it("refuses every change", async () => {
    const res = get("/api/shipments", { method: "POST", body: "{}" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/saves no changes/);
  });

  it("lets a handler answer first, such as a sign-in that always works", async () => {
    const res = answer(recording, new Request(`${DEMO_ORIGIN}/api/sign-in`, { method: "POST" }), {
      handlers: [(req, url) => (req.method === "POST" && url.pathname === "/api/sign-in" ? json(200, { ok: true }) : undefined)],
    });
    expect(await res.json()).toEqual({ ok: true });
  });

  it("lets a fallback answer a read the recording holds otherwise", async () => {
    const res = answer(recording, new Request(`${DEMO_ORIGIN}/api/shipments?status=in%20transit&sort=id`), {
      fallbacks: [(_r, url, rec) => (url.searchParams.has("sort") ? json(200, JSON.parse(rec["/api/shipments?status=in transit"]!.body)) : undefined)],
    });
    expect(await res.json()).toEqual({ page: "filtered" });
  });
});

describe("ownURL", () => {
  it("reads a relative URL, a file: URL and a null-origin URL as the app's own", () => {
    expect(ownURL("/api/me")?.href).toBe(`${DEMO_ORIGIN}/api/me`);
    expect(ownURL("file:///api/me?x=1")?.href).toBe(`${DEMO_ORIGIN}/api/me?x=1`);
    expect(ownURL("null/api/me")?.href).toBe(`${DEMO_ORIGIN}/api/me`);
    expect(ownURL(`${DEMO_ORIGIN}/api/me`)?.href).toBe(`${DEMO_ORIGIN}/api/me`);
  });

  it("leaves data:, blob: and other origins to the browser, except origins named as the app's", () => {
    expect(ownURL("data:text/plain,hi")).toBeNull();
    expect(ownURL("blob:https://x/1")).toBeNull();
    expect(ownURL("https://fonts.example.com/a.css")).toBeNull();
    expect(ownURL("https://api.example.com/v1/me", ["https://api.example.com"])?.href).toBe(`${DEMO_ORIGIN}/v1/me`);
  });
});

describe("installReplay", () => {
  it("answers the app's fetch, by path or by Request, and passes others on", async () => {
    const native = vi.fn(async () => new Response("native"));
    window.fetch = native as unknown as typeof fetch;
    installReplay(recording);
    expect(await (await fetch("/api/me")).json()).toEqual({ email: "demo@app.example" });
    expect(await (await fetch(new Request(`${DEMO_ORIGIN}/api/me`))).json()).toEqual({ email: "demo@app.example" });
    expect(await (await fetch("https://cdn.example.com/x.js")).text()).toBe("native");
    expect(native).toHaveBeenCalledTimes(1);
  });
});

describe("replayXHR", () => {
  const XHR = () => new (replayXHR(recording))();
  const done = (x: XMLHttpRequest) => new Promise<void>((r) => x.addEventListener("loadend", () => r()));

  it("answers JSON as an XMLHttpRequest client reads it, firing its events", async () => {
    const x = XHR();
    const states: number[] = [];
    x.onreadystatechange = () => states.push(x.readyState);
    x.open("GET", "/api/me");
    x.responseType = "json";
    const loaded = vi.fn();
    x.onload = loaded;
    x.send();
    await done(x);
    expect(x.status).toBe(200);
    expect(x.response).toEqual({ email: "demo@app.example" });
    expect(x.getResponseHeader("content-type")).toBe("application/json");
    expect(states).toEqual([1, 2, 3, 4]);
    expect(loaded).toHaveBeenCalledOnce();
  });

  it("answers text and blobs, and a missing read as a 404", async () => {
    const t = XHR();
    t.open("GET", "/api/me");
    t.send();
    await done(t);
    expect(JSON.parse(t.responseText)).toEqual({ email: "demo@app.example" });

    const b = XHR();
    b.open("GET", "/api/reports/r1/pdf");
    b.responseType = "blob";
    b.send();
    await done(b);
    expect(await (b.response as Blob).text()).toBe("%PDF-1.7");

    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = XHR();
    m.open("GET", "/api/nothing");
    m.send();
    await done(m);
    expect(m.status).toBe(404);
  });
});

describe("readJSON and readRecording", () => {
  it("reads what a chapter quotes, by any spelling of its path", () => {
    expect(readJSON(recording, "/api/shipments?status=in%20transit")).toEqual({ page: "filtered" });
    expect(readJSON(recording, "/api/nothing")).toBeUndefined();
    expect(readJSON(recording, "/api/reports/r1/pdf")).toBeUndefined();
  });

  it("reads the recording a page carries, gzipped in base64", async () => {
    const data = gzipSync(Buffer.from(JSON.stringify(recording))).toString("base64");
    document.body.innerHTML = `<script type="application/octet-stream" id="${RECORDING_ID}">${data}</script>`;
    expect(await readRecording()).toEqual(recording);
  });

  it("names a download as its Content-Disposition does", () => {
    expect(downloadName('attachment; filename="a b.pdf"')).toBe("a b.pdf");
    expect(downloadName("attachment; filename=c.json")).toBe("c.json");
    expect(downloadName(undefined, "x")).toBe("x");
  });
});
