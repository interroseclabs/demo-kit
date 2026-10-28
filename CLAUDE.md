# CLAUDE.md

demo-kit turns a single-page app into an offline guided demo. README.md says what it is for teams; `plugin/skills/guided-demo/SKILL.md` is the method an agent follows to make a demo of some other app with it.

## The kit stays app-agnostic

Nothing in `src/`, `cli/` or `bin/` names an app. What one app needs (its replay quirks, its sign-in, its crawl) goes through a hook (`replay.handlers`, `replay.fallbacks`, `package --transform`, the app's own crawl script) rather than into the kit. qSIGHT, where the kit came from (interroseclabs/qsight, `web/src/demo/`), is a consumer like any other.

## Contracts other code depends on

- The checker drives the tour by `data-gd` attributes (`welcome`, `start`, `card` with `data-gd-step`/`-anchor`/`-click`, `next`, `end`, `resume-tour`, `hotspot`, `contact`, `failed`) inside `.gd-ui`'s shadow root, and reads `window.__demoKit`. Change one side, change the other.
- The `Not in this demo: <key>  [<request>]` console line (`MISSING` in `src/replay.ts`) is what `check` counts and `fetch` reads back. A POST read's request is `POST <path> <body>`, the form a crawl's line takes too.
- `recordingKey` keys the recording in the page, in `package` and, through `bodyHash`, in `record`: a POST read is `POST <key> <body hash>`. They all import the one function.
- `film` drives the page by `window.__demoKit.film`, which `mountDemo` defines, not enumerable so `check` never sees it: the tour in full, `enter` (the tour's own `enterStep`), `find`, `describe`, `box` and `press`. Change one side, change the other.
- A same-origin frame's first script calls `parent.demoKitReplay?.(window)`, which `startDemo` defines, for its reads to be answered.
- The skill pins the package by tag. A release bumps the version in `package.json`, `VERSION` in `src/index.tsx`, `plugin/.claude-plugin/plugin.json`, the marketplace entry, and the install lines in the skill and README together (`test/cli/version.test.mjs` holds them to one), then tags `vX.Y.Z`.

## Before finishing a change

`npm test` and `npm run e2e` (the sample SPA recorded, packaged, checked and filmed in headless Chrome). A change to the tour's look gets a look: run the e2e with `KEEP=1` and open `test/e2e/out/harbor-demo.html`; a change to the film's, `test/e2e/out/film/website/embed-example.html` and its videos.
