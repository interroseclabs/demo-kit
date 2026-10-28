# demo-kit

Turn a single-page app into an **offline guided demo**: one HTML file a prospect opens from an email attachment, with no server, no install and no sign-in. It is the real app, not a mock-up: every screen, filter and download is the product's own, and only its API is replaced, answered from a recording of a dev install.

Over the app sits a Walnut-style tour with two modes:

- **Guided tour**: the page dimmed around each stop, a card beside it, a pulsing marker on what to click, chapters, and Back and Next. Next does a click step's click for the viewer.
- **Explore freely**: the app to click around in, with the tour's stops left on each page as hotspots, and a way back into the tour where it was left.

It came out of qSIGHT's offline demo, and it is the same engine, so every team's demo looks and behaves alike.

## Does it fit your app?

It does when your app is drawn in the browser from JSON it reads over HTTP GET, or by POSTs to paths that only read (a dashboard's chart queries, a search), which are recorded by their body: React, Vue or Angular with a client-side router, built with Vite (or a bundler you can set to one chunk). A frame of the app's own origin, such as an embedded dashboard built into the page, is part of the demo: the tour points into it and it reads from the recording too. It doesn't fit when pages come as server-rendered HTML (Next.js server components, Rails or Django templates), when reads and writes share one POST path (GraphQL), or when the data arrives over a WebSocket. Those need a snapshot capture instead.

## Before you start

- **Claude Code, Node 22 or newer, and Google Chrome**, which `visit`, `check` and `film` drive (`CHROME` names another Chrome or Chromium). `film` needs `ffmpeg` too.
- **The app's source**, running in dev (`npm install`, `npm run dev`). The demo is a build of the app's own front end with the tour inside it, so a running container or image of the app isn't enough on its own.
- **A dev install of the app with synthetic data**, its API reachable from your machine, for the recorder to sit in front of. A Docker container does: publish its port (`docker run -p 8000:8000 …`) and record with `--upstream http://localhost:8000`, adding `--insecure` if it serves a self-signed certificate.

## Make one with Claude Code

Add the plugin, then ask Claude to make a guided demo of your app:

```bash
claude plugin marketplace add interroseclabs/demo-kit
claude plugin install demo-kit@demo-kit
```

The `guided-demo` skill walks the method: the fit check, installing this package, wiring a demo build, recording synthetic data only, writing chapters whose figures come from the recording, packaging for a prospect, and checking the page until it passes. It installs this package and uses it as installed; it never writes its own copy of the engine.

## Make one by hand

The skill ([`plugin/skills/guided-demo/SKILL.md`](https://github.com/interroseclabs/demo-kit/blob/main/plugin/skills/guided-demo/SKILL.md)) is the method; read it as a checklist. In short:

```bash
npm install -D github:interroseclabs/demo-kit#v0.1.1
cp node_modules/@interroseclabs/demo-kit/templates/...   # demo.html, src/demo/, vite.demo.config.ts, demo/routes.txt

npx demo-kit record --upstream http://127.0.0.1:8000 --recording demo/recording.json   # a proxy in front of your dev API
npx demo-kit visit --origin http://localhost:5173 --routes demo/routes.txt              # your dev server, its /api proxied to the recorder
npx demo-kit fetch --paths demo/paths.txt                                               # what clicks reach, from your crawl
npx vite build --config vite.demo.config.ts
npx demo-kit package --recording demo/recording.json --build dist-demo --out acme-demo.html \
  --prospect "Acme" --contact-url https://example.com/book --contact-label "Book a session"
npx demo-kit check acme-demo.html --routes demo/routes.txt                              # until: the demo is ready to send
```

`npx demo-kit --help` has every flag. [`examples/sample-spa`](https://github.com/interroseclabs/demo-kit/tree/main/examples/sample-spa) is a small app wired for a demo: its `src/demo/` and `demo/` are what a team writes.

## Film it for a website

The same tour, as video for a home page: a module that plays the product through by itself, like BigID's "find it, fix it, govern it" reel. `demo-kit film` opens the packaged page in headless Chrome, hides the tour and walks it as the tour does, filming each step as a shot: a camera moves over the app to the step's element, a cursor goes to it, a spotlight and a ring light it, the step's title and body come up beside it, and the cursor takes the step's click. The shots are cut together with dissolves:

```bash
npx demo-kit film acme-demo.html --out film --stills        # one still a shot, to check the framing
npx demo-kit film acme-demo.html --out film --wide --logo logo-on-dark.svg
```

| In `film/` | What it is |
|---|---|
| `website/*-walkthrough-*`, `website/*-chapter-N-*` | The whole tour, and each chapter alone, 2:1: H.264 and VP9 at 1920×960, H.264 at 1280×640, a poster, and the steps as WebVTT chapters. |
| `website/timings.json` | Each video's chapters and steps, with the second each starts and its card is up: what a step timeline under the video reads. |
| `website/embed-example.html` | A working reference of the module: a tab a chapter, the video, step bars that fill as it plays and seek when clicked, the step's words. Plain HTML, CSS and JS, to port. |
| `film/*-film-1920x1080.mp4` | With `--wide`: a 16:9 film, with title, chapter and closing cards around the footage, for YouTube, LinkedIn and decks. |

There is no shot list to write: the shots are the tour's steps, and the chapters its chapters. A step's optional `film` field steers what the automatic framing gets wrong, such as the camera's zoom or the card's side, a short label for the module, or `via`, clicks that show the way in through the app's menu. Colours and type are the tour's `--gd-*` tokens unless `--color` and `--font` say otherwise, and the cards' words are the tour's own unless `--product`, `--tagline`, `--closing` and the contact flags say otherwise.

## What your app supplies

| File | What it is |
|---|---|
| `demo.html`, `vite.demo.config.ts` | The demo build's page and config: `demoBuild()` makes it one script and one stylesheet. |
| `src/demo/main.tsx` | `startDemo()`: reads the recording, answers the API from it, frames the page with the tour, and renders your app into the frame with hash routing. |
| `src/demo/chapters.ts` | The tour: chapters of steps, each a route, an anchor found by accessible name, and words whose figures are read from the recording; `film` hints where the video needs them. |
| `src/demo/demo.css` | Your brand colours, as `--gd-*` tokens. |
| `demo/routes.txt`, `demo/crawl.mjs` | Every page a viewer can open, and every read a click can reach, for the recorder to keep. |

## Rules that keep a demo safe to send

- **Synthetic data only.** The page carries every response it recorded, and anyone it is sent to can read all of it. `demo-kit package` refuses a recording with an email address at a domain other than the reserved example ones unless you say the domain is synthetic.
- **Nothing from the network.** The page loads nothing but itself; `demo-kit check` fails on any request that leaves it.
- **Changes are refused.** The recorder lets no write through to your dev install, and the demo answers every write with "it saves no changes".
- **Checked before it is sent.** A demo goes out once `demo-kit check` prints `the demo is ready to send`.

## Developing the kit

```bash
npm install        # builds dist/ too
npm test           # the engine's tests in jsdom, and the CLI's
npm run e2e        # the sample SPA recorded, packaged, checked and filmed in headless Chrome (CHROME names the browser; needs ffmpeg)
```

Release by bumping the version in `package.json`, `src/index.tsx`, the plugin's `plugin.json`, the marketplace entry and the skill's install line together (a test holds them to one), then tagging `vX.Y.Z`.
