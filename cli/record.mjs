// demo-kit record: a proxy in front of a dev install of the app. Point the app's dev server at it
// and open each page the demo shows: every GET under the API prefix that answers 200 is kept.
// Anything but a read is refused, except the requests --pass names (signing in), which go
// through unrecorded, so a recording walk changes nothing.
import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const HOP = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer", "content-length", "content-encoding"]);

export function parseHeader(h) {
  const at = h.indexOf(":");
  if (at <= 0) throw new Error(`--header "${h}" isn't "Name: value"`);
  return [h.slice(0, at).trim().toLowerCase(), h.slice(at + 1).trim()];
}

// passes is whether a request may go through unrecorded: "POST /api/sign-in" names a method and a
// path prefix.
export function passes(rules, method, path) {
  return rules.some((r) => {
    const [m, p] = r.trim().split(/\s+/, 2);
    return m.toUpperCase() === method && p && path.startsWith(p);
  });
}

// isText is whether a body of this type is kept as text, not base64.
export const isText = (type) => /^(application\/(json|.*\+json|xml|.*\+xml|javascript)|text\/)/i.test(type);

export function startRecorder({ upstream, recording, listen = "127.0.0.1:8481", prefix = "/api/", headers = [], pass = [], insecure = false, maxBody = 8 << 20, log = console.log }) {
  const up = new URL(upstream);
  const send = up.protocol === "https:" ? httpsRequest : httpRequest;
  const extra = headers.map(parseHeader);
  const records = existsSync(recording) ? JSON.parse(readFileSync(recording, "utf8")) : {};
  let dirty = false;

  const flush = () => {
    if (!dirty) return;
    dirty = false;
    const tmp = `${recording}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(Object.keys(records).sort().map((k) => [k, records[k]]))));
    renameSync(tmp, recording);
  };
  // Saved at most every 2 s: rewriting the whole file on every response slows a crawl of
  // thousands of them until connections time out.
  const every = setInterval(flush, 2000);

  const keep = (path, type, disposition, body) => {
    const text = isText(type);
    const entry = { type, body: text ? body.toString("utf8") : body.toString("base64") };
    if (!text) entry.base64 = true;
    if (disposition) entry.disposition = disposition;
    const fresh = !(path in records);
    records[path] = entry;
    dirty = true;
    if (fresh) log(`${String(body.length).padStart(9)}  ${path}`);
  };

  const server = createServer((req, res) => {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";
    const read = method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (!read && !passes(pass, method, path)) {
      const body = JSON.stringify({ error: "The demo recorder changes nothing." });
      res.writeHead(403, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
      res.end(body);
      req.resume();
      return;
    }
    const out = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && k !== "host" && k !== "accept-encoding") out[k] = v;
    for (const [k, v] of extra) out[k] = v;
    out.host = up.host;
    out["accept-encoding"] = "identity";
    const forward = send(
      { protocol: up.protocol, hostname: up.hostname, port: up.port, method, path: up.pathname.replace(/\/$/, "") + path, headers: out, rejectUnauthorized: !insecure },
      (answer) => {
        const chunks = [];
        answer.on("data", (c) => chunks.push(c));
        answer.on("end", () => {
          const body = Buffer.concat(chunks);
          const type = String(answer.headers["content-type"] ?? "");
          if (method === "GET" && path.startsWith(prefix) && answer.statusCode === 200) {
            if (body.length > maxBody) log(`not kept, ${body.length} bytes: ${path}`);
            else keep(path, type, answer.headers["content-disposition"], body);
          }
          const back = {};
          for (const [k, v] of Object.entries(answer.headers)) if (!HOP.has(k)) back[k] = v;
          back["content-length"] = body.length;
          res.writeHead(answer.statusCode ?? 502, back);
          res.end(method === "HEAD" ? undefined : body);
        });
      },
    );
    forward.on("error", (e) => {
      const body = JSON.stringify({ error: `The recorder couldn't reach ${upstream}: ${e.message}` });
      if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
      res.end(body);
    });
    req.pipe(forward);
  });

  const [host, port] = [listen.slice(0, listen.lastIndexOf(":")), Number(listen.slice(listen.lastIndexOf(":") + 1))];
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      log(`recording ${upstream} on http://${listen} into ${recording}`);
      resolve({
        server,
        records,
        flush,
        async close() {
          clearInterval(every);
          const closed = new Promise((r) => server.close(r));
          server.closeAllConnections?.();
          await closed;
          flush();
        },
      });
    });
  });
}

export async function record(opts) {
  const rec = await startRecorder(opts);
  const stop = async () => {
    await rec.close();
    console.log(`saved ${Object.keys(rec.records).length} responses to ${opts.recording}`);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
