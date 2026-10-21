import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server sends /api to Harbor's API, or to demo-kit's recorder in front of it
// (HARBOR_API), with the dev token a signed-in browser would carry.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.HARBOR_API ?? "http://127.0.0.1:8601",
        headers: { Authorization: `Bearer ${process.env.HARBOR_TOKEN ?? "dev-token"}` },
      },
    },
  },
});
