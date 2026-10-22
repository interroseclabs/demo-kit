import { describe, expect, it } from "vitest";

import { describeAnchor, findAnchor, sameRoute, sectionName } from "../../src/anchor";

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
