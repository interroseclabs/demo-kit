// jsdom lays nothing out: every element is drawn, at the size a test gives it, or 100 by 20.
import { afterEach, beforeEach } from "vitest";

const sizes = new WeakMap<Element, DOMRect>();

export function sizeOf(e: Element, r: { left: number; top: number; width: number; height: number }) {
  sizes.set(e, new DOMRect(r.left, r.top, r.width, r.height));
}

// drawFrame lays out a frame's window as the page's is: its elements are its own window's, so
// they need the same stand-ins.
export function drawFrame(win: Window) {
  const E = (win as Window & typeof globalThis).Element;
  E.prototype.getClientRects = function (this: Element) {
    const hidden = (this as HTMLElement).hidden || this.closest("[hidden]") !== null || !this.isConnected;
    return (hidden ? [] : [this.getBoundingClientRect()]) as unknown as DOMRectList;
  };
  E.prototype.getBoundingClientRect = function (this: Element) {
    return sizes.get(this) ?? new DOMRect(10, 100, 100, 20);
  };
  E.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  drawFrame(window);
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  localStorage.clear();
  location.hash = "";
});
