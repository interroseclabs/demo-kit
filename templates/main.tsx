// The offline demo's start, for a React app on React Router. Replace each APP with the app's own;
// for another framework, keep startDemo and render the app the way its own main does, routed by
// the URL's hash (Vue Router's createWebHashHistory, Angular's withHashLocation).
import { startDemo } from "@interroseclabs/demo-kit";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

// APP: import the app's routes, and its global stylesheet if its own main imports one.
import { routes } from "../app";
import { chapters, estate } from "./chapters";
import "./demo.css";

void startDemo({
  tour: (recording) => ({
    chapters: chapters(recording),
    text: {
      title: "APP interactive demo",
      welcome: {
        heading: "APP: what the app does for the viewer, in one line",
        body: `This is APP itself, with ${estate(recording)}: every screen, figure and download is the product's own. It runs in this browser, and nothing you do here is saved.`,
      },
      end: { points: ["APP: what the viewer saw, one line a chapter."] },
    },
    // The height of a bar the app keeps fixed at the window's foot, which the tour leaves uncovered.
    bottomInset: 0,
  }),
  render: (mount) =>
    createRoot(mount).render(
      <StrictMode>
        <RouterProvider router={createHashRouter(routes)} />
      </StrictMode>,
    ),
});
