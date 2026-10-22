# demo-kit

Turn a single-page app into an **offline guided demo**: one HTML file a prospect opens from an email attachment, with no server, no install and no sign-in. It is the real app, not a mock-up: every screen, filter and download is the product's own, and only its API is replaced, answered from a recording of a dev install.

Over the app sits a Walnut-style tour with two modes:

- **Guided tour**: the page dimmed around each stop, a card beside it, a pulsing marker on what to click, chapters, and Back and Next. Next does a click step's click for the viewer.
- **Explore freely**: the app to click around in, with the tour's stops left on each page as hotspots, and a way back into the tour where it was left.

It came out of qSIGHT's offline demo, and it is the same engine, so every team's demo looks and behaves alike.

## Does it fit your app?

It does when your app is drawn in the browser from JSON it reads over HTTP GET: React, Vue or Angular with a client-side router, built with Vite (or a bundler you can set to one chunk). It doesn't when pages come as server-rendered HTML (Next.js server components, Rails or Django templates), when reads are POSTs (GraphQL), or when the data arrives over a WebSocket. Those need a snapshot capture instead.

## Before you start

- **Read access to this repo.** It is private: ask an owner of interroseclabs to add you, and sign git in to GitHub (`gh auth login`), since the plugin and the package both come from here.
- **Claude Code, Node 22 or newer, and Google Chrome**, which `visit` and `check` drive (`CHROME` names another Chrome or Chromium).
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

## What your app supplies

| File | What it is |
|---|---|
| `demo.html`, `vite.demo.config.ts` | The demo build's page and config: `demoBuild()` makes it one script and one stylesheet. |
| `src/demo/main.tsx` | `startDemo()`: reads the recording, answers the API from it, frames the page with the tour, and renders your app into the frame with hash routing. |
| `src/demo/chapters.ts` | The tour: chapters of steps, each a route, an anchor found by accessible name, and words whose figures are read from the recording. |
| `src/demo/demo.css` | Your brand colours, as `--gd-*` tokens. |
| `demo/routes.txt`, `demo/crawl.mjs` | Every page a viewer can open, and every read a click can reach, for the recorder to keep. |

## CI

The app's CI installs the kit from this private repo, which it can't do without a credential: npm is refused, and the build fails. Give it a read-only deploy key, once per app repo:

```bash
ssh-keygen -t ed25519 -N "" -C "<app> CI reads demo-kit" -f /tmp/demo-kit-ci
gh repo deploy-key add /tmp/demo-kit-ci.pub --repo interroseclabs/demo-kit --title "<app> CI (read-only)"
gh secret set DEMO_KIT_DEPLOY_KEY --repo interroseclabs/<app> < /tmp/demo-kit-ci
rm /tmp/demo-kit-ci /tmp/demo-kit-ci.pub
```

Then load it in each job that runs `npm ci`, before it:

```yaml
- name: Read access to demo-kit
  env:
    DEMO_KIT_DEPLOY_KEY: ${{ secrets.DEMO_KIT_DEPLOY_KEY }}
  run: |
    install -m 700 -d ~/.ssh
    printf '%s\n' "$DEMO_KIT_DEPLOY_KEY" > ~/.ssh/demo-kit && chmod 600 ~/.ssh/demo-kit
    echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" >> ~/.ssh/known_hosts
    git config --global core.sshCommand "ssh -i ~/.ssh/demo-kit -o IdentitiesOnly=yes"
```

The host key is GitHub's published one, so nothing is trusted on first use.

## Rules that keep a demo safe to send

- **Synthetic data only.** The page carries every response it recorded, and anyone it is sent to can read all of it. `demo-kit package` refuses a recording with an email address at a domain other than the reserved example ones unless you say the domain is synthetic.
- **Nothing from the network.** The page loads nothing but itself; `demo-kit check` fails on any request that leaves it.
- **Changes are refused.** The recorder lets no write through to your dev install, and the demo answers every write with "it saves no changes".
- **Checked before it is sent.** A demo goes out once `demo-kit check` prints `the demo is ready to send`.

## Developing the kit

```bash
npm install        # builds dist/ too
npm test           # the engine's tests in jsdom, and the CLI's
npm run e2e        # the sample SPA recorded, packaged and checked in headless Chrome (CHROME names the browser)
```

Release by bumping the version in `package.json`, `src/index.tsx`, the plugin's `plugin.json`, the marketplace entry and the skill's install line together (a test holds them to one), then tagging `vX.Y.Z`.
