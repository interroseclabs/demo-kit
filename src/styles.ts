// The demo kit's styles. LIGHT goes in the page's head: the frame, the app's element, and the
// theme's tokens, with no specificity, so an app themes the tour by setting them on .gd-frame in
// its own stylesheet:
//
//   .gd-frame { --gd-accent: #0f766e; --gd-accent-fg: #fff; }
//
// SHADOW goes in the tour's shadow root, where no stylesheet of the app's reaches: the tour looks
// the same over any app, and only the tokens, which inherit, change it.

export const LIGHT = `:where(.gd-frame) {
  --gd-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --gd-dim: rgb(0 0 0 / 0.55);
}
.gd-frame {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.gd-ui {
  display: block;
  flex: none;
}
:where(.gd-frame[data-gd-theme="dark"]) {
  --gd-bg: #0b0f17;
  --gd-surface: #131a28;
  --gd-fg: #e7eaf0;
  --gd-muted: #1d2536;
  --gd-muted-fg: #9aa4b8;
  --gd-border: #2a3347;
  --gd-accent: #4c8dff;
  --gd-accent-fg: #ffffff;
}
:where(.gd-frame[data-gd-theme="light"]) {
  --gd-bg: #f6f7f9;
  --gd-surface: #ffffff;
  --gd-fg: #111827;
  --gd-muted: #eef0f4;
  --gd-muted-fg: #5b6475;
  --gd-border: #dde1e8;
  --gd-accent: #2563eb;
  --gd-accent-fg: #ffffff;
}

/* The app's element: its fixed elements sit in it, under the bar, and it scrolls as a page would. */
.gd-app {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  transform: translateZ(0);
}
.gd-mount {
  height: 100%;
  overflow: auto;
}
`;

export const SHADOW = `*,
*::before,
*::after {
  box-sizing: border-box;
}
:host {
  color: var(--gd-fg);
  /* The app's font, unless --gd-font names another. */
  font-family: var(--gd-font);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: normal;
  text-align: left;
  text-transform: none;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
:where(h1, h2, p, ul, ol, li) {
  margin: 0;
  padding: 0;
  list-style: none;
}
svg {
  flex-shrink: 0;
}
:focus-visible {
  outline: 2px solid var(--gd-accent);
  outline-offset: 2px;
}

.gd-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gd-grow {
  flex: 1;
}
.gd-mono {
  font-family: var(--gd-mono);
  font-size: 11px;
  color: var(--gd-muted-fg);
  font-variant-numeric: tabular-nums;
}
.gd-kicker {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gd-accent);
}
.gd-kicker-wide {
  font-size: 11px;
  letter-spacing: 0.14em;
}

/* ── Buttons ── */

.gd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--gd-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 150ms,
    color 150ms,
    border-color 150ms;
}
.gd-btn:disabled {
  opacity: 0.5;
  pointer-events: none;
}
.gd-btn-sm {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
}
.gd-btn-lg {
  height: 40px;
  padding: 0 20px;
}
.gd-btn-icon {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
}
.gd-btn-primary {
  background: var(--gd-accent);
  color: var(--gd-accent-fg);
}
.gd-btn-primary:hover {
  background: color-mix(in oklab, var(--gd-accent) 88%, var(--gd-fg));
}
.gd-btn-outline {
  border-color: var(--gd-border);
  background: var(--gd-bg);
}
.gd-btn-outline:hover,
.gd-btn-ghost:hover {
  background: var(--gd-muted);
}

/* ── The bar ── */

.gd-bar {
  position: relative;
  z-index: 90;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid color-mix(in oklab, var(--gd-accent) 20%, transparent);
  background: var(--gd-surface);
}
.gd-bar-side {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
}
.gd-bar-end {
  justify-content: flex-end;
}
.gd-bar-mark {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: color-mix(in oklab, var(--gd-accent) 15%, transparent);
  color: var(--gd-accent);
}
.gd-bar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 600;
}
.gd-bar-prospect {
  font-weight: 400;
  color: var(--gd-muted-fg);
}
.gd-modes {
  display: flex;
  flex-shrink: 0;
  padding: 2px;
  border: 1px solid var(--gd-border);
  border-radius: 8px;
  background: var(--gd-bg);
}
.gd-mode {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gd-muted-fg);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 150ms,
    color 150ms;
}
.gd-mode:hover {
  color: var(--gd-fg);
}
.gd-mode-on,
.gd-mode-on:hover {
  background: var(--gd-accent);
  color: var(--gd-accent-fg);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
}
.gd-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: color-mix(in oklab, var(--gd-accent) 10%, transparent);
}
.gd-progress-fill {
  height: 100%;
  background: var(--gd-accent);
  transition: width 500ms ease-out;
}

/* ── The chapter list ── */

.gd-contents {
  position: relative;
}
.gd-contents > .gd-btn {
  font-size: 12px;
}
.gd-chapters {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 95;
  width: 320px;
  max-width: calc(100vw - 2rem);
  margin: 8px 0 0;
  padding: 6px;
  border: 1px solid var(--gd-border);
  border-radius: 12px;
  background: var(--gd-surface);
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
}
.gd-chapter {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.gd-chapter:hover {
  background: color-mix(in oklab, var(--gd-muted) 60%, transparent);
}
.gd-chapter-on {
  background: color-mix(in oklab, var(--gd-accent) 10%, transparent);
}
.gd-chapter-words {
  min-width: 0;
}
.gd-chapter-title {
  display: block;
  font-size: 12.5px;
  font-weight: 500;
}
.gd-chapter-blurb {
  display: block;
  font-size: 11.5px;
  color: var(--gd-muted-fg);
}
.gd-num {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  margin: 1px 0 0;
  border: 1px solid var(--gd-border);
  border-radius: 999px;
  color: var(--gd-muted-fg);
  font-size: 10.5px;
  font-weight: 600;
}
.gd-num-done {
  border-color: var(--gd-accent);
  background: var(--gd-accent);
  color: var(--gd-accent-fg);
}
.gd-num-accent {
  border-color: color-mix(in oklab, var(--gd-accent) 40%, transparent);
  color: var(--gd-accent);
}

/* ── The guided tour ── */

.gd-dim {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 70;
  overflow: hidden;
  pointer-events: none;
}
.gd-dim-all {
  background: var(--gd-dim);
  pointer-events: auto;
  transition: opacity 300ms;
}
.gd-hole {
  position: absolute;
  border-radius: 10px;
  box-shadow:
    0 0 0 2px color-mix(in oklab, var(--gd-accent) 80%, transparent),
    0 0 0 9999px var(--gd-dim);
  transition:
    left 300ms ease-out,
    top 300ms ease-out,
    width 300ms ease-out,
    height 300ms ease-out;
}
.gd-block {
  position: absolute;
  pointer-events: auto;
}
.gd-beacon {
  position: fixed;
  z-index: 72;
  pointer-events: none;
}
.gd-beacon-ring {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  box-shadow: 0 0 0 2px var(--gd-accent);
  animation: gd-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.gd-beacon-dot {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  width: 14px;
  height: 14px;
}
.gd-ping {
  position: absolute;
  display: inline-flex;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: var(--gd-accent);
  opacity: 0.7;
  animation: gd-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.gd-dot {
  position: relative;
  display: inline-flex;
  width: 14px;
  height: 14px;
  border: 2px solid var(--gd-surface);
  border-radius: 999px;
  background: var(--gd-accent);
}
.gd-dot-sm {
  width: 12px;
  height: 12px;
}

.gd-card {
  position: fixed;
  z-index: 80;
  width: 352px;
  border: 1px solid color-mix(in oklab, var(--gd-accent) 30%, transparent);
  border-radius: 12px;
  background: var(--gd-surface);
  color: var(--gd-fg);
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.45);
  transition:
    left 300ms ease-out,
    top 300ms ease-out;
}
.gd-card-narrow {
  right: 12px;
  left: 12px;
  width: auto;
}
.gd-arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  border: 0 solid color-mix(in oklab, var(--gd-accent) 30%, transparent);
  background: var(--gd-surface);
}
.gd-arrow-right {
  left: -6px;
  border-bottom-width: 1px;
  border-left-width: 1px;
}
.gd-arrow-left {
  right: -6px;
  border-top-width: 1px;
  border-right-width: 1px;
}
.gd-arrow-bottom {
  top: -6px;
  border-top-width: 1px;
  border-left-width: 1px;
}
.gd-arrow-top {
  bottom: -6px;
  border-right-width: 1px;
  border-bottom-width: 1px;
}
.gd-card-body {
  padding: 16px;
}
.gd-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.gd-card-count {
  display: flex;
  align-items: center;
  gap: 4px;
}
.gd-card-title {
  margin: 6px 0 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.375;
}
.gd-card-text {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.625;
  color: var(--gd-muted-fg);
}
.gd-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0 0;
  padding: 8px 10px;
  border: 1px solid color-mix(in oklab, var(--gd-accent) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in oklab, var(--gd-accent) 10%, transparent);
  font-size: 12.5px;
  line-height: 1.375;
}
.gd-hint-nudged {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--gd-accent) 60%, transparent);
}
.gd-hint-icon {
  margin: 1px 0 0;
  color: var(--gd-accent);
}
.gd-held {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.375;
  color: var(--gd-muted-fg);
}
.gd-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
}
.gd-pips {
  display: flex;
  gap: 3px;
  margin: 12px 0 0;
}
.gd-pip {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--gd-muted);
}
.gd-pip-on {
  background: var(--gd-accent);
}

/* ── Exploring freely ── */

.gd-hotspot {
  position: fixed;
  z-index: 75;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
}
.gd-hotspot .gd-ping {
  opacity: 0.6;
}
.gd-spot {
  position: fixed;
  z-index: 80;
  width: 288px;
  padding: 14px;
  border: 1px solid color-mix(in oklab, var(--gd-accent) 30%, transparent);
  border-radius: 12px;
  background: var(--gd-surface);
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.45);
}
.gd-spot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.gd-spot-title {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.375;
}
.gd-spot-text {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.625;
  color: var(--gd-muted-fg);
}
.gd-spot-go {
  margin: 10px 0 0;
}
.gd-resume {
  position: fixed;
  left: 16px;
  z-index: 75;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid color-mix(in oklab, var(--gd-accent) 30%, transparent);
  border-radius: 12px;
  background: var(--gd-surface);
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3);
}

/* ── The welcome and the end ── */

.gd-overlay {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 85;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 16px;
  background: color-mix(in oklab, var(--gd-bg) 70%, transparent);
  backdrop-filter: blur(4px);
}
.gd-panel {
  width: 100%;
  max-width: 36rem;
  padding: 24px;
  border: 1px solid color-mix(in oklab, var(--gd-accent) 25%, transparent);
  border-radius: 16px;
  background: var(--gd-surface);
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
}
.gd-panel-title {
  margin: 8px 0 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
}
.gd-panel-text {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.625;
  color: var(--gd-muted-fg);
}
.gd-intro-chapters {
  display: grid;
  gap: 4px;
  margin: 16px 0 0;
}
.gd-intro-chapters .gd-chapter {
  padding: 6px 8px;
}
.gd-panel-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 20px 0 0;
}
.gd-panel-foot {
  margin: 16px 0 0;
  font-size: 11.5px;
  color: var(--gd-muted-fg);
}
.gd-points {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  font-size: 13.5px;
  line-height: 1.625;
}
.gd-points li {
  display: flex;
  gap: 10px;
}
.gd-point-icon {
  margin: 4px 0 0;
  color: var(--gd-accent);
}

/* ── Motion ── */

.gd-pop {
  animation: gd-pop 300ms ease-out;
}
.gd-in-up {
  animation: gd-in-up 300ms ease-out;
}
.gd-in-left {
  animation: gd-in-left 300ms ease-out;
}
@keyframes gd-pop {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
}
@keyframes gd-in-up {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
@keyframes gd-in-left {
  from {
    opacity: 0;
    transform: translateX(-4px);
  }
}
@keyframes gd-ping {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}
@keyframes gd-pulse {
  50% {
    opacity: 0.5;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}

/* ── Narrow windows ── */

@media (min-width: 640px) {
  .gd-intro-chapters {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 767px) {
  .gd-bar-prospect,
  .gd-contents-label {
    display: none;
  }
}
@media (max-width: 639px) {
  .gd-bar {
    gap: 8px;
    padding: 0 12px;
  }
  .gd-mode-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .gd-bar-cta {
    display: none;
  }
}
`;
