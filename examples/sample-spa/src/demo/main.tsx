import "./demo.css";

import { startDemo } from "@interroseclabs/demo-kit";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { routes } from "../app";
import { chapters, company } from "./chapters";

// The offline demo: Harbor itself, its API answered from the recording the page carries, routed
// by the URL's hash, since a page opened as a file has no server to route paths. The tour frames
// it, guided or explored freely.
void startDemo({
  tour: (recording) => ({
    chapters: chapters(recording),
    text: {
      title: "Harbor interactive demo",
      welcome: {
        heading: "Every shipment, where it is and why it's late",
        body: `This is Harbor itself, tracking ${company(recording)}: every screen, figure and download is the product's own. It runs in this browser, and nothing you do here is saved.`,
      },
      end: {
        points: [
          "Every shipment's status and delay, on one page.",
          "From a figure to the shipments behind it, in one click.",
          "Each shipment's bill of lading, and reports to download.",
        ],
      },
    },
    // Harbor's status bar, which the tour's dim leaves uncovered.
    bottomInset: 24,
  }),
  render: (mount) =>
    createRoot(mount).render(
      <StrictMode>
        <RouterProvider router={createHashRouter(routes)} />
      </StrictMode>,
    ),
});
