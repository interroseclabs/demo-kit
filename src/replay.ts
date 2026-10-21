// The offline demo's API. A demo build answers every call the app makes to its own API from a
// recording of a dev install, so it opens from a file, with no server, on any machine: fetch and
// XMLHttpRequest alike, and a link to a recorded file downloads it.

export type Recorded = {
  type: string;
  body: string;
  // The body is base64: a PDF, or anything else that isn't text.
  base64?: boolean;
  disposition?: string;
};

// Recording is every recorded GET, keyed by recordingKey.
export type Recording = Record<string, Recorded>;

// DEMO_ORIGIN is the origin the demo's own requests are read against. A page opened as a file has
// the origin "null", which no request URL can be built on: an API client that builds absolute
// URLs calls this origin in a demo build.
export const DEMO_ORIGIN = "https://app.demo";

// RECORDING_ID is the id of the <script> that `demo-kit package` writes the recording into.
export const RECORDING_ID = "demo-recording";

// MISSING is how the demo says, on the console, that the recording lacks a read: the read's key,
// then the request as sent, in brackets, which `demo-kit fetch` can read through the recorder.
// `demo-kit check` counts these lines, so their words must not change.
export const MISSING = "Not in this demo: ";

// recordingKey is a request's key in a recording: its path, decoded, and its query's parameters,
// decoded and sorted, so neither encoding nor order matters. `demo-kit package` keys the
// recording with this same function.
export function recordingKey(url: URL): string {
  const params = [...url.searchParams].sort(([a, av], [b, bv]) => compare(a, b) || compare(av, bv));
  const path = safeDecode(url.pathname);
  return params.length === 0 ? path : `${path}?${params.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

// recordingKeyOf is recordingKey for a path and query as a proxy sees it, such as "/api/x?b=2&a=1".
export function recordingKeyOf(raw: string): string {
  return recordingKey(new URL(raw, DEMO_ORIGIN));
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// json is a JSON response, for a handler's answer.
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// bytes is a recorded body as the install sent it.
export function bytes(r: Recorded): Uint8Array<ArrayBuffer> | string {
  if (!r.base64) return r.body;
  const raw = atob(r.body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// readJSON is what the recording holds for a GET of path, parsed, or undefined: chapters read
// their figures with it, so a step's words quote what the demo will show.
export function readJSON<T = unknown>(recording: Recording, path: string): T | undefined {
  const r = recording[recordingKeyOf(path)];
  if (!r || r.base64) return undefined;
  try {
    return JSON.parse(r.body) as T;
  } catch {
    return undefined;
  }
}

// Handler answers a request the recording can't by key: a sign-in that always works, a list the
// app reads in an order it wasn't recorded in. Undefined passes it on.
export type Handler = (request: Request, url: URL, recording: Recording) => Response | undefined;

export type ReplayOptions = {
  // Handlers tried, in order, before the recording, for every request to the app's own API.
  handlers?: Handler[];
  // Handlers tried, in order, after a GET the recording lacks, before it is refused.
  fallbacks?: Handler[];
  // Other origins the app calls as its own API, such as "https://api.example.com". Requests to any
  // other origin, and to data: and blob: URLs, go to the browser's own fetch.
  origins?: string[];
  // What the refusal of a change says.
  refusal?: string;
  // What a read the recording lacks says.
  missing?: string;
};

// lookup is what the recording holds for url, or undefined.
export function lookup(recording: Recording, url: URL): Recorded | undefined {
  return recording[recordingKey(url)];
}

// answer is the demo's response to request, a request to the app's own API.
export function answer(recording: Recording, request: Request, options: ReplayOptions = {}): Response {
  const url = new URL(request.url);
  for (const h of options.handlers ?? []) {
    const r = h(request, url, recording);
    if (r) return r;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(403, { error: options.refusal ?? "This is a demo of recorded data: it saves no changes." });
  }
  const hit = lookup(recording, url);
  if (!hit) {
    for (const h of options.fallbacks ?? []) {
      const r = h(request, url, recording);
      if (r) return r;
    }
    console.warn(`${MISSING}${recordingKey(url)}  [${url.pathname}${url.search}]`);
    return json(404, { error: options.missing ?? "That view isn't in this demo. The guided tour shows what is." });
  }
  const headers: Record<string, string> = { "Content-Type": hit.type };
  if (hit.disposition) headers["Content-Disposition"] = hit.disposition;
  return new Response(request.method === "HEAD" ? null : bytes(hit), { status: 200, headers });
}

// ownURL is raw read as a request to the app's own API, or null for one that isn't: another
// origin, or a data: or blob: URL. A page opened as a file resolves "/api/x" to file:///api/x, and
// an API client that builds URLs from location.origin makes "null/api/x".
export function ownURL(raw: string, origins: string[] = []): URL | null {
  if (/^(data|blob|about|javascript):/i.test(raw)) return null;
  if (raw.startsWith("null/")) raw = raw.slice(4);
  if (/^file:/i.test(raw)) {
    const u = new URL(raw);
    return new URL(u.pathname + u.search, DEMO_ORIGIN);
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("//")) return new URL(raw, DEMO_ORIGIN);
  const u = new URL(raw);
  if (u.origin === DEMO_ORIGIN || origins.includes(u.origin)) return new URL(u.pathname + u.search, DEMO_ORIGIN);
  if (typeof location !== "undefined" && /^https?:$/.test(location.protocol) && u.origin === location.origin) return new URL(u.pathname + u.search, DEMO_ORIGIN);
  return null;
}

// readRecording reads the recording the demo's page carries: gzipped JSON, in base64, in a
// <script type="application/octet-stream" id="demo-recording">.
export async function readRecording(doc: Document = document): Promise<Recording> {
  const el = doc.getElementById(RECORDING_ID);
  if (!el?.textContent) throw new Error("This page carries no recording: package it with demo-kit package.");
  const gz = bytes({ type: "", body: el.textContent.trim(), base64: true }) as Uint8Array<ArrayBuffer>;
  const text = await new Response(new Response(gz).body!.pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(text) as Recording;
}

// downloadName is the file name a Content-Disposition gives, quoted or not.
export function downloadName(disposition: string | undefined, fallback = "download"): string {
  return /filename="?([^";]+)"?/.exec(disposition ?? "")?.[1]?.trim() || fallback;
}

// installReplay answers every request the app makes to its own API from recording, by fetch or by
// XMLHttpRequest, and turns each link to a recorded file into a download of it.
export function installReplay(recording: Recording, options: ReplayOptions = {}): void {
  const own = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = ownURL(raw, options.origins);
    if (!url) return own(input, init);
    const request = input instanceof Request ? new Request(url, input) : new Request(url, init);
    return answer(recording, request, options);
  };
  window.XMLHttpRequest = replayXHR(recording, options);
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      const href = a?.getAttribute("href");
      if (!a || !href || href.startsWith("#")) return;
      const url = ownURL(href, options.origins);
      if (!url) return;
      const hit = lookup(recording, url);
      if (!hit) return;
      e.preventDefault();
      const blob = URL.createObjectURL(new Blob([bytes(hit)], { type: hit.type }));
      const save = document.createElement("a");
      save.href = blob;
      save.download = downloadName(hit.disposition, url.pathname.split("/").pop() || "download");
      save.click();
      setTimeout(() => URL.revokeObjectURL(blob), 60_000);
    },
    true,
  );
}

// replayXHR is an XMLHttpRequest that answers the app's own API from recording, for apps whose
// client is built on it (axios, older clients). Any other request goes to the browser's own.
export function replayXHR(recording: Recording, options: ReplayOptions = {}): typeof XMLHttpRequest {
  const Native = window.XMLHttpRequest;
  class ReplayXHR extends EventTarget {
    static readonly UNSENT = 0;
    static readonly OPENED = 1;
    static readonly HEADERS_RECEIVED = 2;
    static readonly LOADING = 3;
    static readonly DONE = 4;
    readonly UNSENT = 0;
    readonly OPENED = 1;
    readonly HEADERS_RECEIVED = 2;
    readonly LOADING = 3;
    readonly DONE = 4;

    readyState = 0;
    status = 0;
    statusText = "";
    responseURL = "";
    responseType: XMLHttpRequestResponseType = "";
    response: unknown = "";
    timeout = 0;
    withCredentials = false;
    readonly upload = new EventTarget();
    onreadystatechange: ((e: Event) => void) | null = null;
    onload: ((e: Event) => void) | null = null;
    onloadend: ((e: Event) => void) | null = null;
    onloadstart: ((e: Event) => void) | null = null;
    onprogress: ((e: Event) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    onabort: ((e: Event) => void) | null = null;
    ontimeout: ((e: Event) => void) | null = null;

    #method = "GET";
    #url: URL | null = null;
    #raw = "";
    #async = true;
    #headers = new Headers();
    #answer: Headers = new Headers();
    #text = "";
    #native: XMLHttpRequest | null = null;
    #aborted = false;

    get responseText(): string {
      if (this.responseType !== "" && this.responseType !== "text") throw new DOMException("responseText needs responseType text", "InvalidStateError");
      return this.#text;
    }

    get responseXML(): Document | null {
      return null;
    }

    open(method: string, url: string | URL, async = true) {
      this.#method = method.toUpperCase();
      this.#raw = String(url);
      this.#url = ownURL(this.#raw, options.origins);
      this.#async = async;
      this.#set(1);
    }

    setRequestHeader(name: string, value: string) {
      this.#headers.append(name, value);
    }

    getResponseHeader(name: string): string | null {
      return this.readyState >= 2 ? this.#answer.get(name) : null;
    }

    getAllResponseHeaders(): string {
      if (this.readyState < 2) return "";
      return [...this.#answer].map(([k, v]) => `${k}: ${v}\r\n`).join("");
    }

    overrideMimeType() {}

    abort() {
      this.#aborted = true;
      this.#native?.abort();
    }

    send(body?: Document | XMLHttpRequestBodyInit | null) {
      if (!this.#url) return this.#passOn(body);
      const init: RequestInit = { method: this.#method, headers: this.#headers };
      if (body != null && this.#method !== "GET" && this.#method !== "HEAD") init.body = body as BodyInit;
      const res = answer(recording, new Request(this.#url, init), options);
      const finish = async () => {
        if (this.#aborted) return this.#fire("abort");
        this.status = res.status;
        this.statusText = res.statusText || (res.status === 200 ? "OK" : "");
        this.responseURL = this.#raw;
        this.#answer = res.headers;
        this.#set(2);
        this.#set(3);
        const buf = await res.arrayBuffer();
        const type = res.headers.get("Content-Type") ?? "";
        const text = () => new TextDecoder().decode(buf);
        switch (this.responseType) {
          case "arraybuffer":
            this.response = buf;
            break;
          case "blob":
            this.response = new Blob([buf], { type });
            break;
          case "json":
            try {
              this.response = JSON.parse(text());
            } catch {
              this.response = null;
            }
            break;
          default:
            this.#text = text();
            this.response = this.#text;
        }
        this.#set(4);
        this.#fire("load");
        this.#fire("loadend");
      };
      this.#fire("loadstart");
      // Even a synchronous request is answered after send returns: the recording is read as a
      // Response, whose body is only ever read asynchronously.
      void finish();
    }

    #passOn(body?: Document | XMLHttpRequestBodyInit | null) {
      const x = new Native();
      this.#native = x;
      x.open(this.#method, this.#raw, this.#async);
      x.responseType = this.responseType;
      x.timeout = this.timeout;
      x.withCredentials = this.withCredentials;
      this.#headers.forEach((v, k) => x.setRequestHeader(k, v));
      x.onreadystatechange = () => {
        this.status = x.status;
        this.statusText = x.statusText;
        this.responseURL = x.responseURL;
        this.#answer = new Headers();
        for (const line of x.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
          const at = line.indexOf(":");
          if (at > 0) this.#answer.append(line.slice(0, at).trim(), line.slice(at + 1).trim());
        }
        if (x.readyState === 4) {
          this.response = x.response;
          if (x.responseType === "" || x.responseType === "text") this.#text = x.responseText;
        }
        this.#set(x.readyState);
      };
      for (const type of ["load", "loadend", "error", "abort", "timeout", "progress"]) x.addEventListener(type, () => this.#fire(type));
      x.send(body);
    }

    #set(state: number) {
      this.readyState = state;
      this.#fire("readystatechange");
    }

    #fire(type: string) {
      const e = new ProgressEvent(type);
      this.dispatchEvent(e);
      const on = (this as unknown as Record<string, unknown>)[`on${type}`];
      if (typeof on === "function") on.call(this, e);
    }
  }
  return ReplayXHR as unknown as typeof XMLHttpRequest;
}
