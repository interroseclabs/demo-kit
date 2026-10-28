// The film's layer, run in a packaged demo's page as `(source)(options)`. It hides the tour, pins
// the app to a canvas the camera moves over, and draws the spotlight, ring, callout card and
// cursor over it; and, at 1920×1080, the film's own title, chapter and closing cards and the frame
// a chapter's footage plays in. Every frame is drawn from a state (__film.frame, __film.card), so
// a frame is the same however long it takes to capture. Its colours are the tour's --gd-* tokens,
// unless options.colors names others; its type is the tour's, unless options.font gives a file.
(o) => {
  const { W, H } = o;
  const kit = window.__demoKit.film;
  const gdFrame = document.querySelector(".gd-frame");
  const app = document.querySelector(".gd-app");
  const mount = document.querySelector(".gd-mount");
  const tokens = getComputedStyle(gdFrame);
  const token = (name, fallback) => o.colors[name] || tokens.getPropertyValue(`--gd-${name}`).trim() || fallback;
  const appFont = tokens.getPropertyValue("--gd-font").trim() || getComputedStyle(mount.firstElementChild ?? mount).fontFamily || "system-ui, sans-serif";
  const font = o.font ? `"demo-kit film", ${appFont}` : appFont;

  // In the page: the tour hidden, the app pinned to the canvas, the film's typeface, and no
  // scrollbars, in the page or its frames, as the film scrolls the page itself.
  const BARS = "* { scrollbar-width: none !important; } ::-webkit-scrollbar { display: none !important; }";
  const quiet = (win) => {
    for (const w of [win, ...[...win.document.querySelectorAll("iframe, frame")].map((f) => { try { return f.contentWindow?.document && f.contentWindow; } catch { return null; } })]) {
      if (!w || w.document.getElementById("demo-kit-film")) continue;
      const style = w.document.createElement("style");
      style.id = "demo-kit-film";
      style.textContent = BARS;
      (w.document.head ?? w.document.documentElement)?.append(style);
      if (w !== win) quiet(w);
    }
  };
  quiet(window);
  const page = document.createElement("style");
  page.textContent = `
  ${o.font ? `@font-face { font-family: "demo-kit film"; src: url(${o.font}); font-weight: 100 900; font-display: block; }` : ""}
  .gd-ui { display: none !important; }
  .gd-app { position: fixed !important; left: 0 !important; top: 0 !important; width: ${W}px !important; height: 100vh !important;
    flex: none !important; transform-origin: 0 0; z-index: 1; }`;
  document.head.append(page);

  const host = document.createElement("div");
  host.style.cssText = "position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
  document.documentElement.append(host);
  const root = host.attachShadow({ mode: "open" });
  const colors = {
    accent: token("accent", "#2563eb"),
    "accent-fg": token("accent-fg", "#ffffff"),
    bg: token("bg", "#0b0f17"),
    surface: token("surface", "#131a28"),
    fg: token("fg", "#e7eaf0"),
    "muted-fg": token("muted-fg", "#9aa4b8"),
    dim: token("dim", "rgb(0 0 0 / 0.55)"),
  };
  for (const [k, v] of Object.entries(colors)) host.style.setProperty(`--${k}`, v);
  host.style.setProperty("--font", font);

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const mark = (cls) => (o.logo ? `<img class="${cls}" src="${o.logo}" alt="">` : `<span class="${cls} word">${esc(o.copy.product)}</span>`);
  const n = o.chapters.length;
  const pad2 = (i) => String(i).padStart(2, "0");
  const contact = o.copy.contact;
  const where = contact ? contact.href.replace(/^mailto:/i, "").replace(/^https:\/\//i, "").replace(/\/$/, "") : "";
  const WIN = o.window;

  root.innerHTML = `<style>
  * { box-sizing: border-box; }
  .shot, .cards { position: absolute; left: 0; top: 0; overflow: hidden; font-family: var(--font); -webkit-font-smoothing: antialiased; }
  .shot { width: ${W}px; height: ${H}px; }
  .spot, .ring { position: absolute; border-radius: 12px; display: none; }
  .spot { box-shadow: 0 0 0 4000px color-mix(in srgb, var(--dim) 50%, transparent); }
  .ring { border: 2px solid var(--accent);
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 16%, transparent), 0 0 28px color-mix(in srgb, var(--accent) 32%, transparent); }
  .card { position: absolute; left: 0; top: 0; width: 360px; display: none; padding: 18px 22px 19px; border-radius: 14px;
    background: var(--surface); color: var(--fg);
    box-shadow: 0 24px 50px -18px rgb(3 10 20 / .6), 0 2px 6px rgb(3 10 20 / .18), inset 0 0 0 1px color-mix(in srgb, var(--fg) 8%, transparent); }
  .card .t { font-size: 19px; line-height: 1.3; font-weight: 640; letter-spacing: -.012em; display: flex; align-items: baseline; gap: 10px; }
  .card .t i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent); transform: translateY(-1px); }
  .card .b { margin-top: 8px; font-size: 15px; line-height: 1.55; color: var(--muted-fg); font-weight: 420; letter-spacing: -.003em; }
  .caret { position: absolute; width: 14px; height: 14px; background: var(--surface); border-radius: 2px; }
  .ripple { position: absolute; display: none; border-radius: 50%; border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .cursor { position: absolute; left: 0; top: 0; width: 32px; height: 32px; display: none; transform-origin: 5.1px 3.4px;
    filter: drop-shadow(0 2px 2.5px rgb(0 0 0 / .3)) drop-shadow(0 0 .5px rgb(0 0 0 / .4)); }

  .cards { width: 1920px; height: 1080px; display: none; color: var(--fg); background: var(--bg); }
  .bg { position: absolute; inset: 0;
    background:
      radial-gradient(1100px 700px at var(--gx, 18%) 8%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 62%),
      radial-gradient(1000px 800px at 92% 100%, color-mix(in srgb, color-mix(in srgb, var(--accent) 35%, #2a5cbe) 30%, transparent), transparent 60%),
      var(--bg); }
  .grid { position: absolute; inset: 0; opacity: .06;
    background-image: linear-gradient(var(--fg) 1px, transparent 1px), linear-gradient(90deg, var(--fg) 1px, transparent 1px);
    background-size: 64px 64px; -webkit-mask-image: radial-gradient(900px 600px at 50% 45%, #000, transparent 75%); }
  .layer { position: absolute; inset: 0; display: none; }
  .center { flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .logo { max-width: 620px; max-height: 120px; object-fit: contain; }
  .logo.word { max-width: 1400px; max-height: none; font-size: 78px; line-height: 1.05; font-weight: 740; letter-spacing: -.035em; }
  .tag { margin-top: 34px; font-size: 30px; line-height: 1.35; font-weight: 450; color: var(--muted-fg); letter-spacing: -.01em; max-width: 1080px; }
  .kicker { font-size: 18px; font-weight: 650; letter-spacing: .32em; color: var(--accent); text-transform: uppercase; }
  .title { margin-top: 22px; font-size: 84px; line-height: 1.04; font-weight: 720; letter-spacing: -.035em; max-width: 1500px; }
  .sub { margin-top: 26px; font-size: 28px; line-height: 1.4; font-weight: 430; color: var(--muted-fg); max-width: 1100px; letter-spacing: -.01em; }
  .cta { margin-top: 44px; display: inline-flex; align-items: center; padding: 18px 30px; border-radius: 999px;
    background: var(--accent); color: var(--accent-fg); font-size: 24px; font-weight: 640; letter-spacing: -.01em;
    box-shadow: 0 18px 40px -14px color-mix(in srgb, var(--accent) 70%, transparent); }
  .url { margin-top: 22px; font-size: 21px; color: var(--muted-fg); letter-spacing: .02em; }
  .win { position: absolute; left: ${WIN.x}px; top: ${WIN.y}px; width: ${WIN.w}px; height: ${WIN.h}px; border-radius: ${WIN.r}px;
    background: #fff; box-shadow: 0 50px 90px -40px rgb(0 0 0 / .85), 0 0 0 1px color-mix(in srgb, var(--fg) 14%, transparent),
      0 0 0 9px color-mix(in srgb, var(--fg) 4.5%, transparent); }
  .stages { position: absolute; left: ${WIN.x}px; width: ${WIN.w}px; top: 908px; display: grid; grid-template-columns: repeat(${n}, minmax(0, 1fr)); gap: ${o.track.gap}px; }
  .stage { position: relative; font-size: ${n > 4 ? 17 : 21}px; font-weight: 600; color: color-mix(in srgb, var(--fg) 42%, transparent);
    letter-spacing: -.005em; display: flex; gap: 12px; align-items: baseline; white-space: nowrap; }
  .stage span { overflow: hidden; text-overflow: ellipsis; }
  .stage b { font-size: 15px; font-weight: 650; letter-spacing: .14em; color: color-mix(in srgb, var(--fg) 32%, transparent); }
  .stage.on { color: var(--fg); } .stage.on b { color: var(--accent); }
  .stage.done { color: color-mix(in srgb, var(--fg) 70%, transparent); } .stage.done .track { background: var(--accent); }
  .track { position: absolute; left: 0; right: 0; top: ${o.track.y - 908}px; height: ${o.track.h}px; border-radius: 3px; background: color-mix(in srgb, var(--fg) 14%, transparent); }
  .head { position: absolute; left: ${WIN.x}px; top: 984px; width: ${WIN.w - 260}px; font-size: 25px; font-weight: 560; letter-spacing: -.012em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mark { position: absolute; right: ${1920 - WIN.x - WIN.w}px; top: 976px; max-width: 240px; max-height: 38px; object-fit: contain; opacity: .9; }
  .mark.word { max-width: 420px; max-height: none; font-size: 22px; font-weight: 680; letter-spacing: -.01em; top: 984px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
  <div class="shot">
    <div class="spot"></div><div class="ring"></div>
    <div class="card"><div class="caret"></div><div class="t"><i></i><span></span></div><div class="b"></div></div>
    <div class="ripple"></div>
    <svg class="cursor" viewBox="0 0 28 28"><path d="M4.5 3v19.2l4.9-4.7 3.3 7.4 3.4-1.5-3.3-7.3h6.8z"
      fill="#141414" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>
  </div>
  <div class="cards">
    <div class="bg"></div><div class="grid"></div>
    <div class="layer center" id="open">${mark("logo")}${o.copy.tagline ? `<div class="tag">${esc(o.copy.tagline)}</div>` : ""}</div>
    <div class="layer center" id="chapter"><div class="kicker"></div><div class="title"></div><div class="sub"></div></div>
    <div class="layer center" id="end">${mark("logo")}<div class="title" style="font-size:64px;margin-top:40px">${esc(o.copy.closing)}</div>
      ${contact ? `<div class="cta">${esc(contact.label)}</div><div class="url">${esc(where)}</div>` : ""}</div>
    <div class="layer" id="frame"><div class="win"></div>
      <div class="stages">${o.chapters.map((c, i) => `<div class="stage" data-i="${i}"><b>${pad2(i + 1)}</b><span>${esc(c.title)}</span><div class="track"></div></div>`).join("")}</div>
      <div class="head"></div>${mark("mark")}</div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const shot = $(".shot"), cards = $(".cards");
  const spot = $(".spot"), ring = $(".ring"), card = $(".card"), caret = $(".caret"), ripple = $(".ripple"), cursor = $(".cursor");

  // The elements a shot scrolls, and where each starts and ends: what brings its element into view.
  let scrollers = [];
  const ancestors = (e) => {
    const out = [];
    for (let at = e; at; at = at.ownerDocument.defaultView?.frameElement ?? null) {
      for (let p = at.parentElement; p; p = p.parentElement) out.push(p);
      const page = at.ownerDocument.scrollingElement;
      if (page && !out.includes(page)) out.push(page);
    }
    return out;
  };
  const scrolls = (e) => {
    const { overflowY } = (e.ownerDocument.defaultView ?? window).getComputedStyle(e);
    return e.scrollHeight > e.clientHeight && (overflowY === "auto" || overflowY === "scroll" || e === e.ownerDocument.scrollingElement);
  };
  const boxOf = (e) => {
    const b = e && kit.box(e);
    return b && b.width > 0 && b.height > 0 ? [b.left, b.top, b.width, b.height] : null;
  };

  let lastCard = "";
  window.__film = {
    // measure reads a shot on the page, the camera off: its focus's and click's boxes, once
    // scrolled into view as the tour scrolls them (or the focus's container to scroll px), and the
    // scrolls that bring them there. The page is left where it was; the shot's frames scroll it.
    measure({ focus, click, scroll }) {
      app.style.transform = "none";
      quiet(window);
      const el = focus ? kit.find(focus) : null;
      const target = el ?? (click ? kit.find(click) : null);
      scrollers = [];
      if (target) {
        const chain = ancestors(target);
        const from = chain.map((e) => e.scrollTop);
        if (scroll != null) {
          const s = chain.find(scrolls);
          if (s) s.scrollTop = scroll;
        } else {
          const tall = target.getBoundingClientRect().height > innerHeight * 0.7;
          target.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest", behavior: "instant" });
        }
        chain.forEach((e, i) => Math.abs(e.scrollTop - from[i]) > 0.5 && scrollers.push({ e, from: from[i], to: e.scrollTop }));
      }
      const m = { focus: boxOf(el), click: click ? boxOf(kit.find(click)) : null, scroll: scrollers.map(({ from, to }) => ({ from, to })) };
      for (const s of scrollers) s.e.scrollTop = s.from;
      return m;
    },
    describe: (anchor) => kit.describe(anchor),
    press(anchor, double) {
      const e = kit.find(anchor);
      if (e) kit.press(e, double);
      return Boolean(e);
    },
    frame(s) {
      shot.style.display = "block";
      cards.style.display = "none";
      const { x: cx, y: cy, z } = s.cam;
      app.style.transform = `translate(${W / 2 - cx * z}px, ${H / 2 - cy * z}px) scale(${z})`;
      if (s.scroll) s.scroll.forEach((y, i) => scrollers[i] && (scrollers[i].e.scrollTop = y));
      const S = (x, y) => [(x - cx) * z + W / 2, (y - cy) * z + H / 2];
      const onScreen = (b, pad) => {
        const [x0, y0] = S(b[0], b[1]);
        const [x1, y1] = S(b[0] + b[2], b[1] + b[3]);
        const l = Math.max(10, x0 - pad), t = Math.max(10, y0 - pad);
        return [l, t, Math.min(W - 10, x1 + pad) - l, Math.min(H - 10, y1 + pad) - t];
      };

      // The spotlight dims everything but the focus; the ring draws round it.
      if (s.focus) {
        const [l, t, w, h] = onScreen(s.focus.box, 8);
        const a = s.focus.a, grow = (1 - a) * 6;
        Object.assign(spot.style, { display: "block", left: l + "px", top: t + "px", width: w + "px", height: h + "px", opacity: a });
        Object.assign(ring.style, { display: "block", left: l - grow + "px", top: t - grow + "px", width: w + 2 * grow + "px", height: h + 2 * grow + "px", opacity: a });
      } else spot.style.display = ring.style.display = "none";

      // The callout, beside the focus where it fits, its caret pointing at it.
      if (s.card) {
        const key = s.card.title + "|" + s.card.body;
        if (key !== lastCard) {
          card.querySelector(".t span").textContent = s.card.title;
          card.querySelector(".b").textContent = s.card.body;
          lastCard = key;
        }
        card.style.display = "block";
        const cw = card.offsetWidth, ch = card.offsetHeight;
        const [l, t, w, h] = s.card.box ? onScreen(s.card.box, 8) : [W / 2, H / 2, 0, 0];
        const gap = 18, m = 22;
        const spots = {
          below: [l + w / 2 - cw / 2, t + h + gap, "up"],
          above: [l + w / 2 - cw / 2, t - gap - ch, "down"],
          right: [l + w + gap, t + h / 2 - ch / 2, "left"],
          left: [l - gap - cw, t + h / 2 - ch / 2, "right"],
          "below-left": [l, t + h + gap, "up"],
          "below-right": [l + w - cw, t + h + gap, "up"],
          "above-left": [l, t - gap - ch, "down"],
          "above-right": [l + w - cw, t - gap - ch, "down"],
          "inside-top-left": [l + 16, t + 16, null],
          "inside-top-right": [l + w - cw - 16, t + 16, null],
          "inside-bottom-left": [l + 16, t + h - ch - 16, null],
          "inside-bottom-right": [l + w - cw - 16, t + h - ch - 16, null],
          "top-left": [m + 6, m, null],
          "top-right": [W - m - 6 - cw, m, null],
          "bottom-left": [m + 6, H - m - ch, null],
          "bottom-right": [W - m - 6 - cw, H - m - ch, null],
        };
        const fits = ([x, y]) => x >= m && y >= m && x + cw <= W - m && y + ch <= H - m;
        const auto = s.card.box ? ["below", "above", "right", "left", "bottom-right"] : ["bottom-right"];
        const order = s.card.place && spots[s.card.place] ? [s.card.place, ...auto] : auto;
        let [x, y, dir] = spots[order.find((p) => fits(spots[p])) ?? "bottom-right"];
        x = Math.min(Math.max(x, m), W - m - cw);
        y = Math.min(Math.max(y, m), H - m - ch);
        const a = s.card.a, rise = (1 - a) * 10;
        const dy = dir === "up" ? rise : dir === "down" ? -rise : 0;
        const dx = dir === "left" ? rise : dir === "right" ? -rise : 0;
        card.style.transform = `translate(${x + dx}px, ${y + dy}px) scale(${0.985 + 0.015 * a})`;
        card.style.opacity = a;
        if (dir && s.card.box) {
          const cxp = Math.min(Math.max(l + w / 2 - x, 26), cw - 26), cyp = Math.min(Math.max(t + h / 2 - y, 22), ch - 22);
          const pos = { up: [cxp - 7, -6], down: [cxp - 7, ch - 8], left: [-6, cyp - 7], right: [cw - 8, cyp - 7] }[dir];
          Object.assign(caret.style, { display: "block", left: pos[0] + "px", top: pos[1] + "px", transform: "rotate(45deg)" });
        } else caret.style.display = "none";
      } else card.style.display = "none";

      // A click's ripple, then the cursor over everything.
      if (s.ripple) {
        const [x, y] = S(s.ripple.x, s.ripple.y);
        const k = s.ripple.k, r = 6 + 22 * k;
        Object.assign(ripple.style, { display: "block", left: x - r + "px", top: y - r + "px", width: 2 * r + "px", height: 2 * r + "px", opacity: (1 - k) * 0.75 });
      } else ripple.style.display = "none";
      const [x, y] = S(s.cursor.x, s.cursor.y);
      cursor.style.display = "block";
      cursor.style.transform = `translate(${x - (4.5 * 32) / 28}px, ${y - (3 * 32) / 28}px) scale(${1 - 0.14 * (s.cursor.press || 0)})`;
    },
    // card draws one of the film's own pictures at t seconds into it: "open", "chapter" (data
    // { i }), "end", or "frame" (data { i }), the still a chapter's footage plays in.
    card(kind, data, t) {
      shot.style.display = "none";
      cards.style.display = "block";
      const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
      const rise = (el, d = 0) => {
        if (!el) return;
        const k = ease((t - d) / 0.7);
        el.style.opacity = k;
        el.style.transform = `translateY(${(1 - k) * 18}px)`;
      };
      for (const l of root.querySelectorAll(".layer")) l.style.display = "none";
      const L = root.getElementById(kind);
      L.style.display = kind === "frame" ? "block" : "flex";
      $(".bg").style.setProperty("--gx", 18 + t * 1.2 + "%");
      if (kind === "open") (rise(L.querySelector(".logo"), 0.25), rise(L.querySelector(".tag"), 0.65));
      if (kind === "chapter") {
        const c = o.chapters[data.i];
        L.querySelector(".kicker").textContent = `${pad2(data.i + 1)}  /  ${pad2(n)}`;
        L.querySelector(".title").textContent = c.title;
        L.querySelector(".sub").textContent = c.blurb;
        rise(L.querySelector(".kicker"), 0.1), rise(L.querySelector(".title"), 0.25), rise(L.querySelector(".sub"), 0.5);
      }
      if (kind === "end") (rise(L.querySelector(".logo"), 0.2), rise(L.querySelector(".title"), 0.45), rise(L.querySelector(".cta"), 0.75), rise(L.querySelector(".url"), 0.9));
      if (kind === "frame") {
        for (const s of L.querySelectorAll(".stage")) {
          s.classList.toggle("on", +s.dataset.i === data.i);
          s.classList.toggle("done", +s.dataset.i < data.i);
        }
        L.querySelector(".head").textContent = o.chapters[data.i].blurb;
      }
    },
  };
  // The colours and type the film uses, for the reference module; the accent as #rrggbb too, for
  // what ffmpeg draws in it.
  const c2d = document.createElement("canvas").getContext("2d");
  c2d.fillStyle = colors.accent;
  c2d.fillRect(0, 0, 1, 1);
  const hex = "#" + [...c2d.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { colors, font: appFont, accent: hex };
}
