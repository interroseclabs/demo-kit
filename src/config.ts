// DemoConfig is what one copy of the demo is made for: the prospect it names, and where its call
// to action goes. `demo-kit package` writes it into the page (--prospect, --contact-url,
// --contact-label), and a page served from a web server takes ?for= too.
export type DemoConfig = {
  prospect: string | null;
  contact: { label: string; href: string } | null;
};

// CONFIG_ID is the id of the <script type="application/json"> that `demo-kit package` writes.
export const CONFIG_ID = "demo-config";

// A call to action goes to a web page or an email, never to a script.
const safeHref = (href: unknown): string | null => (typeof href === "string" && /^(https:|mailto:)/i.test(href) ? href : null);

export function readConfig(doc: Document = document, search: string = location.search): DemoConfig {
  let written: Record<string, unknown> = {};
  try {
    written = JSON.parse(doc.getElementById(CONFIG_ID)?.textContent ?? "{}") as Record<string, unknown>;
  } catch {
    // A page without one, or with one that doesn't parse, is a demo for nobody in particular.
  }
  const asked = new URLSearchParams(search).get("for");
  const prospect = (typeof written.prospect === "string" ? written.prospect : null) || asked || null;
  const contact = written.contact as { label?: unknown; href?: unknown } | undefined;
  const href = safeHref(contact?.href);
  return {
    prospect: prospect ? prospect.trim().slice(0, 60) || null : null,
    contact: href ? { label: typeof contact?.label === "string" && contact.label.trim() ? contact.label.trim() : "Talk to us", href } : null,
  };
}
