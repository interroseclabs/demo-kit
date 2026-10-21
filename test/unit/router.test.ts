import { describe, expect, it } from "vitest";

import { hashRouter, whereInHash } from "../../src/router";

describe("whereInHash", () => {
  it("reads a hash router's route, its query and its own hash", () => {
    expect(whereInHash("#/documents/BOL-1?x=1#L4")).toEqual({ pathname: "/documents/BOL-1", search: "?x=1", hash: "#L4" });
    expect(whereInHash("")).toEqual({ pathname: "/", search: "", hash: "" });
  });
});

describe("hashRouter", () => {
  it("moves the app by its hash, and hears the app's own moves", async () => {
    const router = hashRouter();
    const heard: string[] = [];
    const stop = router.subscribe(() => heard.push(router.location().pathname));
    router.navigate("/shipments?status=delayed");
    expect(location.hash).toBe("#/shipments?status=delayed");
    expect(router.location()).toEqual({ pathname: "/shipments", search: "?status=delayed", hash: "" });
    // A router moves with pushState, which fires no event.
    history.pushState(null, "", "#/reports");
    await new Promise((r) => setTimeout(r, 300));
    stop();
    expect(heard).toContain("/reports");
  });
});
