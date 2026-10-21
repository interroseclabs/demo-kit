// Where the tour's card sits beside the element it points at, as a Walnut or Navattic tooltip
// sits: on the side with room for it, its arrow toward the element; over the element's corner
// where no side has room, as for a section taller than the window.

export type Box = { left: number; top: number; width: number; height: number };
export type Side = "right" | "left" | "bottom" | "top" | "inside";
export type Placement = { left: number; top: number; side: Side };

const GAP = 14;
const MARGIN = 12;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

// visibleBox is the part of target inside view, or null where none of it is.
export function visibleBox(target: Box, view: Box): Box | null {
  const left = Math.max(target.left, view.left);
  const top = Math.max(target.top, view.top);
  const right = Math.min(target.left + target.width, view.left + view.width);
  const bottom = Math.min(target.top + target.height, view.top + view.height);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

// place is where a card of size card sits beside hole, inside view. Without a hole it sits over
// the view's lower right, where a page's own content is least often.
export function place(hole: Box | null, card: { width: number; height: number }, view: Box): Placement {
  const minX = view.left + MARGIN;
  const minY = view.top + MARGIN;
  const maxX = view.left + view.width - card.width - MARGIN;
  const maxY = view.top + view.height - card.height - MARGIN;
  if (!hole) return { left: clamp(maxX, minX, maxX), top: clamp(maxY, minY, maxY), side: "inside" };

  const room = {
    right: view.left + view.width - (hole.left + hole.width) - GAP - MARGIN,
    left: hole.left - view.left - GAP - MARGIN,
    bottom: view.top + view.height - (hole.top + hole.height) - GAP - MARGIN,
    top: hole.top - view.top - GAP - MARGIN,
  };
  const midY = hole.top + hole.height / 2 - card.height / 2;
  const midX = hole.left + hole.width / 2 - card.width / 2;
  // Beside it first, as a reader's eye moves across, then below or above it.
  if (room.right >= card.width) return { left: hole.left + hole.width + GAP, top: clamp(midY, minY, maxY), side: "right" };
  if (room.left >= card.width) return { left: hole.left - GAP - card.width, top: clamp(midY, minY, maxY), side: "left" };
  if (room.bottom >= card.height) return { left: clamp(midX, minX, maxX), top: hole.top + hole.height + GAP, side: "bottom" };
  if (room.top >= card.height) return { left: clamp(midX, minX, maxX), top: hole.top - GAP - card.height, side: "top" };
  return {
    left: clamp(hole.left + hole.width - card.width - GAP, minX, maxX),
    top: clamp(hole.top + hole.height - card.height - GAP, minY, maxY),
    side: "inside",
  };
}
