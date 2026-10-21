import { describe, expect, it } from "vitest";

import { CONFIG_ID, readConfig } from "../../src/config";

function written(v: unknown) {
  document.body.innerHTML = `<script type="application/json" id="${CONFIG_ID}">${JSON.stringify(v)}</script>`;
}

describe("readConfig", () => {
  it("is a demo for nobody in particular without a config", () => {
    expect(readConfig(document, "")).toEqual({ prospect: null, contact: null });
  });

  it("reads the prospect and the call to action package wrote", () => {
    written({ prospect: " Acme ", contact: { href: "https://example.com/book", label: "Book a session" } });
    expect(readConfig(document, "")).toEqual({ prospect: "Acme", contact: { href: "https://example.com/book", label: "Book a session" } });
  });

  it("takes ?for= on a page without a prospect", () => {
    expect(readConfig(document, "?for=Globex").prospect).toBe("Globex");
  });

  it("calls to a web page or an email only, never a script", () => {
    written({ contact: { href: "javascript:alert(1)" } });
    expect(readConfig(document, "").contact).toBeNull();
    written({ contact: { href: "mailto:sales@example.com" } });
    expect(readConfig(document, "").contact).toEqual({ href: "mailto:sales@example.com", label: "Talk to us" });
  });
});
