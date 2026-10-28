---
name: guided-demo
description: Make an offline guided demo of a single-page app, one HTML file that opens from disk with the real app answering from a recorded API and a Walnut-style tour over it. Use to build a demo of an app, re-record one after the app changes, package one for a prospect, or film its tour as video for a website.
---

# Guided demo

A **guided demo** is the app itself, its API answered from a **recording** of a dev install, packaged with a tour into one HTML file a prospect opens from an email attachment. The tour has two modes: guided (the page dimmed around each stop, a card beside it, Next does the click) and explore freely (the tour's stops left as hotspots).

The engine, the replay, the recorder and the checker are the `@interroseclabs/demo-kit` package. Install it pinned and use it as installed: every team's demo then looks and behaves the same, and a fix to the kit reaches every demo by a version bump. The app supplies only its glue: a demo entry, its chapters, its routes list, its crawl.

An app with its glue committed (`src/demo/`, `demo/`) already has a demo: re-recording starts at step 5, packaging for another prospect at step 7, and filming it for the website at step 9.

Work through the steps in order. Each ends on its **done when** line.

## 1. Fit

The kit needs the app's source, runnable in dev: the demo is a build of the app's own front end with the tour inside it. A running container or image of the app is the dev install to record from, never the whole of what is needed; with no source, tell the user so and stop.

The kit fits an app whose pages are drawn in the browser from data it reads over HTTP. Read the app's `package.json`, its router and its API client, then run it in dev with the browser's network panel open and click through it. In the panel, look at the requests each page makes: their method, their path's prefix, what they answer, whether a POST only reads (a chart's query, a search) or changes something, and anything sent to another origin, over a WebSocket, or from inside a frame.

It fits when all three hold:

- **Client-side routing**: React Router, Vue Router, Angular's router, TanStack Router, or similar, in an app served as static files (Vite, webpack, Angular CLI).
- **Reads are GETs under one prefix**, such as `/api/`, answering JSON, or files the app links to for download, **or POSTs to paths that only read**, such as a dashboard's `/api/v1/chart/data`: those are recorded by their body. The kit replays `fetch` and `XMLHttpRequest` (axios) alike, and a link to a recorded file downloads it. Writes can be anything: the demo refuses them.
- **Auth the recorder can carry**: a cookie or header it can forward or inject.

A frame of the app's own origin (a `srcdoc` preview, an embedded dashboard whose source you have) is part of the page: the tour points into it, and it reads from the recording too (step 3). A frame from another origin is outside the demo.

It doesn't fit when pages arrive as server-rendered HTML (Next.js server components or `getServerSideProps`, Remix loaders, Rails, Django or PHP templates), when reads and writes share one POST path (GraphQL, RPC: naming it as a read would let its writes through the recorder), or when the data arrives over a WebSocket or server-sent events. Stop there and tell the user this kit can't replay that app: a **snapshot capture** of the rendered pages is needed instead.

**Done when** you can name the router, the API prefix, the POST paths that read (if any) and the auth, or you have told the user the app needs a snapshot capture.

## 2. Install

```bash
npm install -D github:interroseclabs/demo-kit#v0.1.1
```

Copy the templates from `node_modules/@interroseclabs/demo-kit/templates/` into the app: `demo.html` and `vite.demo.config.ts` at the root beside `index.html`, `main.tsx`, `chapters.ts` and `demo.css` in `src/demo/`, `routes.txt` in `demo/`. Replace each `APP` in `demo.html`, `vite.demo.config.ts` and `main.tsx` now; an `APP` line with nothing in this app to name (a stylesheet its main doesn't import) goes. `chapters.ts` keeps its placeholders until step 6, when the recording has the figures it quotes. `npx demo-kit --help` lists every command and flag.

**Done when** `npx demo-kit --help` prints and the templates are in the app.

## 3. The demo build

Adapt the copied entry until the app runs inside the frame:

- **Hash routing.** A page opened from a file has no server to route paths: render the app's routes with the router's hash history (`createHashRouter`, `createWebHashHistory`, `withHashLocation`). Steps' `to` are routes as the router routes them.
- **The API client** calls relative URLs (`/api/x`) or `DEMO_ORIGIN` from `@interroseclabs/demo-kit/replay`. One that builds URLs from `location.origin` works as is. One that calls another origin names it in `startDemo({ replay: { origins: ["https://api.example.com"] } })`.
- **Sign-in.** A demo opens signed in: the recording answers the app's "who am I" read. A sign-in the app posts on its own is answered with a `replay.handlers` entry.
- **Frames.** A same-origin frame that reads the API has as its first script `parent.demoKitReplay?.(window)`, so the demo answers its reads as it answers the page's. A frame that is a second app (an embedded dashboard) is built as one script too and given to its frame as `srcdoc`; [reference.md](reference.md) has the details.
- **Fixed footer**: give its height as `bottomInset`, so the tour's dim leaves it uncovered.
- **Colours**: set the `--gd-*` tokens in `src/demo/demo.css` to the app's own; [reference.md](reference.md) says what each one paints.
- **One script.** `demoBuild()` makes the build one script and one stylesheet with every asset inlined, beside the page's icon, which `package` inlines too. An app on webpack or the Angular CLI configures its bundler for one chunk with inlined assets.

**Done when** `npx vite build --config vite.demo.config.ts` writes one `.js` file.

## 4. Synthetic data

Record a dev install loaded with **synthetic** data: the app's seed, fixtures or generator, with invented companies, people and addresses. The page carries every response the recording holds, and anyone it is sent to can read all of it, so a customer's data, production data or a colleague's real account never goes in.

`demo-kit package` refuses a recording holding an email address at any domain but the reserved example ones (`example.com`, `*.example`, `*.test`, `*.invalid`). Replace the signed-in dev user's address with `--replace real@corp.com=demo@app.example`. Allow a domain with `--allow-domain` only when the generator invented it.

**Done when** you can name where the data came from and it is invented.

## 5. Record

`demo/routes.txt` lists every page a viewer reaches by the app's own navigation (its menu, tabs and filters), one route a line, as the address bar shows it after the `#`, encoded (`/shipments?status=in%20transit`). A page reached only by clicking a record (a row's detail, a document, a download) is the crawl's: `demo/crawl.mjs` reads the recording so far and prints the paths those clicks read, one a line. A click that reads by POST (a chart's filter, a toggle) is a line of its own, its body as the app sends it: `POST /api/query {"measure":"delayed","by":"carrier"}`.

Start the recorder in front of the dev install's API, naming each POST path that only reads with `--read`, point the dev server's API proxy (Vite's `server.proxy`) at the recorder, then visit the routes and read the crawl's paths through it:

```bash
npx demo-kit record --upstream http://127.0.0.1:8000 --recording demo/recording.json --listen 127.0.0.1:8481 \
  --header "Authorization: Bearer <dev token>" --read "POST /api/query"
npx demo-kit visit --origin http://localhost:5173 --routes demo/routes.txt
node demo/crawl.mjs demo/recording.json > demo/paths.txt
npx demo-kit fetch --paths demo/paths.txt --via http://127.0.0.1:8481
```

`visit` and `fetch` reach the recorder at the address `record --listen` gave. Leave the recorder running into step 8; Ctrl-C saves the recording and stops it, and starting it again with the same `--recording` adds to it.

Add `demo/recording.json`, `demo/paths.txt`, `demo/misses.txt`, `dist-demo/` and the packaged pages to `.gitignore`. Keep the recording where it lasts, outside `/tmp`, which macOS empties: packaging for the next prospect needs only it and a build.

**Done when** `visit` has opened every route and `fetch` reports every path answered 200.

## 6. Chapters

Write `src/demo/chapters.ts`: four to seven chapters, each two to five steps, walking the story the app tells from data in to result out, and the end screen's points, one a chapter. [reference.md](reference.md) has the step fields and anchor forms.

- **Anchors find what a viewer finds**: a `section` by its accessible name, an element by its `label` (aria-label), a button, link or table row by its `text`. Where an element has no accessible name, add one to the app (`aria-label` on a section): that helps every screen reader user too. A CSS `selector` is the last resort, for what has no name at all.
- **Figures come from the recording.** Read each with `readJSON(recording, path)`, or a POST read's with `readJSON(recording, path, { method: "POST", body })`, and quote it, with words that still stand when the read is missing. Pick what a step features (a record to open, a port to name) from the recording too, so the anchor, the click and the words all point at the same thing. A figure typed by hand goes stale with the next recording.
- **Click steps** carry the story forward: the card asks the viewer to click what it points at, and Next clicks it for them. A step whose element only shows once something is open (a dialog, a panel) names that in `needs`.
- **Copy states facts**: what the viewer is looking at and what it means, in the app's own terms. Titles are a few words; bodies are one or two sentences; a chapter's title and blurb fit one line each.

**Done when** every step has an anchor in one of the forms above and every figure in a body is read from the recording.

## 7. Package

Ask the user who the copy is for and where its call to action goes, then package:

```bash
npx vite build --config vite.demo.config.ts
npx demo-kit package --recording demo/recording.json --build dist-demo --out demo/app-demo-acme.html \
  --prospect "Acme" --contact-url "https://example.com/book" --contact-label "Book a session"
```

The bar and the welcome name the prospect; the bar and the end screen carry the call to action, an `https:` or `mailto:` link the user gave you. Without them the demo is for nobody in particular.

**Done when** `demo-kit package` has written the page.

## 8. Check

```bash
npx demo-kit check demo/app-demo-acme.html --routes demo/routes.txt --misses demo/misses.txt
```

It opens the page from a file in headless Chrome, opens every route, downloads a recorded file, walks the tour by its own Next from the welcome to the end screen, explores freely, and opens the tour at a phone's width. Each `FAIL` names its cause:

- **Not in the recording**: a read the recording lacks, listed in `demo/misses.txt`, a POST read with its body. With the recorder running, `npx demo-kit fetch --paths demo/misses.txt --via http://127.0.0.1:8481` reads them, sending each POST's body; add any that a click reaches to the crawl. Then build, package and check again.
- **Its element isn't on the page**: the step's anchor names nothing on its page. Fix the anchor, or the step's `to`.
- **Cut off**: a chapter's title or blurb too long for its line. Shorten it.
- **Page error** or **loads from the network**: the app's own bug in the demo build, or a font, script or call it fetches from elsewhere. Inline the asset, or record the call.

Repeat until the last line reads `the demo is ready to send`. A page that hasn't printed it isn't handed over: report the failing lines instead. Then look at it yourself, as the check can't judge words: open the page and read the welcome, each chapter's first card and the end screen.

**Done when** `demo-kit check` exits 0 with `the demo is ready to send`, and you have read the welcome, the cards and the end screen.

## 9. Film (when the website needs video)

Only when the user asks for a video of the demo, for a home page or a product page. `demo-kit film` films the tour from the checked page, a shot a step, into 2:1 videos (the whole tour and each chapter), their steps' timings, and a reference module that plays them like BigID's "find it, fix it, govern it" reel. `--wide` adds a 16:9 film with title, chapter and closing cards. It needs `ffmpeg`.

Film from a page packaged without `--prospect`: the website's video is for nobody in particular. First the stills, one a shot, to check the framing in a few seconds:

```bash
npx demo-kit film demo/app-demo.html --out demo/film --stills
```

Look at every still in `demo/film/stills/`. A shot framed wrong (the card over what it explains, the camera too close or too wide, a step reached in a way a viewer wouldn't) is fixed by the step's `film` hints ([reference.md](reference.md)), then build, package and take the stills again. Then film it, with the brand the user gives you (`--logo`, `--color`, `--font`; copy flags in `npx demo-kit --help`):

```bash
npx demo-kit film demo/app-demo.html --out demo/film --wide --logo brand/logo-on-dark.svg
```

Filming is at 2× and 60 fps, a few minutes for a tour of a minute; run it in the background. Add `demo/film/` to `.gitignore`.

**Done when** you have looked at every still, `demo/film/website/` holds each video with `timings.json` and `embed-example.html`, and the embed plays from that folder.

## 10. Hand over

Stop the recorder, the dev server and the API. Give the user the page's path, its size (over 20 MB won't go as most email attachments; share it as a link), the prospect and the call to action it carries, and the check's last lines; and, if you filmed it, the film's folder. Commit the glue so the next demo of this app starts at step 5: `demo.html`, `vite.demo.config.ts`, `src/demo/`, `demo/routes.txt`, `demo/crawl.mjs`, `.gitignore`, and `package.json` with its lockfile, which hold the kit's pinned version.
