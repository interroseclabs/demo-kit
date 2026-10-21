import { describe, expect, it } from "vitest";

import { place, visibleBox } from "../../src/place";

const view = { left: 0, top: 44, width: 1200, height: 800 };
const card = { width: 340, height: 220 };

describe("place", () => {
  it("puts the card to the right of a small element with room there, level with it", () => {
    const p = place({ left: 100, top: 300, width: 200, height: 40 }, card, view);
    expect(p.side).toBe("right");
    expect(p.left).toBe(100 + 200 + 14);
    expect(p.top).toBe(300 + 20 - 110);
  });

  it("puts it to the left of an element against the right edge, as a side panel is", () => {
    const p = place({ left: 780, top: 44, width: 420, height: 800 }, card, view);
    expect(p.side).toBe("left");
    expect(p.left).toBe(780 - 14 - 340);
  });

  it("puts it below a full-width element with room under it", () => {
    expect(place({ left: 20, top: 60, width: 1160, height: 300 }, card, view).side).toBe("bottom");
  });

  it("lays it over the corner of an element that fills the view, inside the view", () => {
    const p = place({ left: 0, top: 44, width: 1200, height: 800 }, card, view);
    expect(p.side).toBe("inside");
    expect(p.left + card.width).toBeLessThanOrEqual(view.width - 12);
    expect(p.top + card.height).toBeLessThanOrEqual(view.top + view.height - 12);
  });

  it("keeps it inside the view beside an element near the top", () => {
    expect(place({ left: 100, top: 50, width: 100, height: 20 }, card, view).top).toBe(view.top + 12);
  });

  it("sits over the lower right with nothing to point at", () => {
    expect(place(null, card, view)).toEqual({ left: 1200 - 340 - 12, top: 44 + 800 - 220 - 12, side: "inside" });
  });
});

describe("visibleBox", () => {
  it("is the part of a tall section inside the view", () => {
    expect(visibleBox({ left: 200, top: -400, width: 600, height: 1900 }, view)).toEqual({ left: 200, top: 44, width: 600, height: 800 });
  });

  it("is null for an element scrolled out of view", () => {
    expect(visibleBox({ left: 200, top: 900, width: 600, height: 100 }, view)).toBeNull();
  });
});
