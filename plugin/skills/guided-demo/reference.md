# Guided demo reference

The kit's types are in `node_modules/@interroseclabs/demo-kit/dist/*.d.ts`; this is how to use them well.

## A step

```ts
{
  id: "delayed-list",                       // unique: progress is kept by it
  title: "The 15 delayed shipments",        // a few words, a figure where one helps
  body: "The list filtered to delayed, …",  // one or two sentences of fact
  to: "/shipments?status=delayed",          // the route, as the router routes it
  anchor: { section: "Shipments table" },   // what the card points at and the dim leaves lit
  click: { on: { selector: "tr.clickable" }, hint: "Click SHP-1001 to open it." },
  needs: { open: { label: "Shipment SHP-1001" }, by: { selector: "tr.clickable" } },
}
```

- Without `anchor` the card sits over the page's lower right, with the page dimmed: use it for a page as a whole.
- `click` makes the step go on when the viewer clicks `click.on` (the anchor when `on` is left out); Next clicks it for them. `double: true` asks for a double-click.
- `needs` names what must be open for the anchor to show (`open`) and what opens it (`by`). The tour clicks `by` itself when the step is entered by Back or from the chapter list, and closes it (Escape, then a Close button) when the next step doesn't need it.
- A click step that opens a dialog is followed by a step that points into the dialog and `needs` it.

## Anchors

In order of preference:

| Form | Finds | Use for |
|---|---|---|
| `{ section: "Delays by port" }` | a `<section>` by its accessible name: `aria-label`, `aria-labelledby`, or its own first heading; any case | a panel, card or region |
| `{ label: "Delayed", starts?: true }` | an element by its `aria-label`, exactly or by its start | a figure, a dialog, an icon button |
| `{ text: "Open the bill of lading", starts?: true, pressed?: true }` | a link, button, tab, row, menu item or option by its words; `pressed` wants `aria-pressed="true"` | something the viewer clicks |
| `{ selector: "tr.clickable" }` | the first visible match | what has no name, such as a table's first row |

Any form takes `in: <anchor>` to look only inside another: `{ text: "Site", in: { section: "Estate map" } }`. Only elements on screen are found, so a hidden duplicate is passed over.

## Figures

```ts
const overview = readJSON<Overview>(recording, "/api/overview");
body: overview ? `${n(overview.delayed)} delayed …` : "The delayed shipments …",
```

`readJSON` finds a read however its path's query is ordered or encoded. Pick what a step features from the data (the first delayed shipment, the worst port), so the tour follows the recording.

## startDemo

```ts
startDemo({
  replay: {
    handlers: [(req, url) => (url.pathname === "/api/sign-in" ? json(200, { ok: true }) : undefined)],
    fallbacks: [],          // answer a GET the recording lacks, such as a list in another sort order
    origins: [],            // other origins the app calls as its own API
  },
  tour: (recording) => ({
    chapters: chapters(recording),
    text: { title, welcome: { kicker?, heading, body }, end: { heading?, points } },
    bottomInset: 24,        // px of fixed footer the dim leaves uncovered
    theme: "dark",          // or "light": the base the tokens start from
    colors: { accent: "#14b8a6", "accent-fg": "#04201d" },
    router: undefined,      // hashRouter() by default
  }),
  render: (mount) => createRoot(mount).render(<App />),
});
```

`mount` is the element under the demo bar; the app's fixed elements sit in it. The tour is drawn in a shadow root, so the app's CSS can't reach it, and its anchors never match the tour's own elements.

## Colours

Tokens on `.gd-frame`, set in `src/demo/demo.css` or by `colors`: `--gd-accent`, `--gd-accent-fg`, `--gd-bg`, `--gd-surface`, `--gd-fg`, `--gd-muted`, `--gd-muted-fg`, `--gd-border`, `--gd-dim`, and `--gd-font` (the app's own font by default).
