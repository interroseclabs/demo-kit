import { describe, expect, it } from "vitest";

import { describeAnchor, findAnchor, sameRoute, screenBox, sectionName, windowsOf } from "../../src/anchor";
import { drawFrame, sizeOf } from "./setup";

function page(html: string) {
  document.body.innerHTML = html;
}

describe("sectionName", () => {
  it("is a section's aria-label", () => {
    page(`<section aria-label="Headline figures"><h2>Figures</h2></section>`);
    expect(sectionName(document.querySelector("section")!)).toBe("Headline figures");
  });

  it("is the text of what it is labelled by, an id with colons as React's useId makes", () => {
    page(`<section aria-labelledby=":r1: :r2:"><h2 id=":r1:">Delays</h2><span id=":r2:">by port</span></section>`);
    expect(sectionName(document.querySelector("section")!)).toBe("Delays by port");
  });

  it("is its own first heading, not a nested section's", () => {
    page(`<section id="outer"><section><h2>Inner</h2></section><h3>Outer</h3></section>`);
    expect(sectionName(document.getElementById("outer")!)).toBe("Outer");
  });
});

describe("findAnchor", () => {
  it("finds a section by its name in any case, skipping one that isn't drawn", () => {
    page(`<section aria-label="Map" hidden id="a"></section><section aria-label="Map" id="b"></section>`);
    expect(findAnchor({ section: "map" })?.id).toBe("b");
  });

  it("finds an element by its aria-label, exactly or by how it starts", () => {
    page(`<a aria-label="Delayed: 15" id="d">15</a><a aria-label="Delayed" id="e">x</a>`);
    expect(findAnchor({ label: "Delayed" })?.id).toBe("e");
    expect(findAnchor({ label: "Delayed", starts: true })?.id).toBe("d");
  });

  it("finds a button by its words, pressed where it says so, inside another anchor", () => {
    page(`
      <section aria-label="Map"><button aria-pressed="false" id="s1">Site</button></section>
      <section aria-label="Grouped"><button aria-pressed="true" id="s2">  Site </button></section>`);
    expect(findAnchor({ text: "Site" })?.id).toBe("s1");
    expect(findAnchor({ text: "Site", pressed: true })?.id).toBe("s2");
    expect(findAnchor({ text: "Site", in: { section: "Grouped" } })?.id).toBe("s2");
    expect(findAnchor({ text: "Site", in: { section: "Nowhere" } })).toBeNull();
  });

  it("finds by words only what a viewer clicks, never a paragraph", () => {
    page(`<p>Open</p><span role="button" id="b">Open</span>`);
    expect(findAnchor({ text: "Open" })?.id).toBe("b");
  });

  it("finds the button in a row, not the row, when both read alike", () => {
    page(`<table><tr id="r"><td><button id="b">Open</button></td></tr></table>`);
    expect(findAnchor({ text: "Open" })?.id).toBe("b");
  });

  it("finds a table row by how its text starts", () => {
    page(`<table><tr id="h"><th>Shipment</th></tr><tr id="r1"><td>SHP-1001</td><td>Santos</td></tr></table>`);
    expect(findAnchor({ text: "SHP-1001", starts: true })?.id).toBe("r1");
  });

  it("finds by a selector, as a last resort", () => {
    page(`<table><tr class="row" id="r1"></tr></table>`);
    expect(findAnchor({ selector: "tr.row" })?.id).toBe("r1");
  });
});

// framed puts a same-origin frame on the page at box, holding html, laid out as the page is.
function framed(html: string, box = { left: 200, top: 300, width: 400, height: 300 }, title = "Preview") {
  const frame = document.createElement("iframe");
  frame.title = title;
  document.body.append(frame);
  sizeOf(frame, box);
  Object.defineProperty(frame, "clientWidth", { value: box.width });
  Object.defineProperty(frame, "clientHeight", { value: box.height });
  drawFrame(frame.contentWindow!);
  const doc = frame.contentDocument!;
  doc.body.innerHTML = html;
  return { frame, doc };
}

describe("an anchor inside a same-origin frame", () => {
  it("is found there when the page itself holds none, the page's own first", () => {
    page(`<p>The page</p>`);
    const { doc } = framed(`<section aria-label="Delays by carrier" id="in"></section><button id="b">By port</button>`);
    expect(findAnchor({ section: "delays by carrier" })).toBe(doc.getElementById("in"));
    document.body.insertAdjacentHTML("afterbegin", `<button id="top">By port</button>`);
    expect(findAnchor({ text: "By port" })?.id).toBe("top");
  });

  it("is found in the frame an `in` names, and in a frame within a frame", () => {
    page(``);
    framed(`<button id="a">Run</button>`, undefined, "Other");
    const { doc } = framed(`<button id="b">Run</button>`);
    expect(findAnchor({ text: "Run", in: { selector: "iframe[title=Preview]" } })).toBe(doc.getElementById("b"));

    const inner = doc.createElement("iframe");
    doc.body.append(inner);
    sizeOf(inner, { left: 0, top: 0, width: 100, height: 100 });
    drawFrame(inner.contentWindow!);
    inner.contentDocument!.body.innerHTML = `<a aria-label="Deep" id="deep">x</a>`;
    expect(findAnchor({ label: "Deep" })).toBe(inner.contentDocument!.getElementById("deep"));
  });

  it("isn't found in a frame that isn't drawn", () => {
    page(``);
    const { frame } = framed(`<button>Run</button>`);
    frame.hidden = true;
    expect(findAnchor({ text: "Run" })).toBeNull();
  });
});

describe("screenBox", () => {
  it("is where an element is in the page's window, through the frames it is in, cut to them", () => {
    page(``);
    const { doc } = framed(`<button id="b">Run</button>`);
    const b = doc.getElementById("b")!;
    sizeOf(b, { left: 10, top: 20, width: 80, height: 30 });
    expect(screenBox(b)).toEqual({ left: 210, top: 320, width: 80, height: 30 });
    sizeOf(b, { left: 380, top: 20, width: 80, height: 30 });
    expect(screenBox(b)).toEqual({ left: 580, top: 320, width: 20, height: 30 });
    sizeOf(b, { left: 500, top: 20, width: 80, height: 30 });
    expect(screenBox(b)).toBeNull();
  });

  it("is an element's own box on the page", () => {
    page(`<button id="b">Run</button>`);
    sizeOf(document.getElementById("b")!, { left: 5, top: 6, width: 7, height: 8 });
    expect(screenBox(document.getElementById("b")!)).toEqual({ left: 5, top: 6, width: 7, height: 8 });
  });
});

describe("windowsOf", () => {
  it("is a window and every same-origin frame's in it", () => {
    page(``);
    const { frame } = framed(`<p>x</p>`);
    expect(windowsOf(window)).toEqual([window, frame.contentWindow]);
  });
});

describe("describeAnchor", () => {
  it("names an anchor as a message would", () => {
    expect(describeAnchor({ text: "remediate", starts: true, in: { label: "Next actions" } })).toBe('text "remediate"… in label "Next actions"');
  });
});

describe("sameRoute", () => {
  it("is the same page whatever the query's order and encoding", () => {
    const at = { pathname: "/shipments", search: "?b=2&status=in%20transit", hash: "" };
    expect(sameRoute(at, "/shipments?status=in transit&b=2")).toBe(true);
    expect(sameRoute(at, "/shipments")).toBe(false);
  });

  it("minds a step's own hash only where it has one", () => {
    expect(sameRoute({ pathname: "/d/1", search: "", hash: "#L4" }, "/d/1")).toBe(true);
    expect(sameRoute({ pathname: "/d/1", search: "", hash: "#L4" }, "/d/1#L5")).toBe(false);
  });
});
