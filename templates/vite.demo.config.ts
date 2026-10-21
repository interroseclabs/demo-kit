// The offline demo's build: the app and the tour in one script and one stylesheet, which
// `demo-kit package` inlines with the recording into one page. Keep the app's own plugins.
import react from "@vitejs/plugin-react";
import { demoBuild } from "@interroseclabs/demo-kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  ...demoBuild({ input: "demo.html" }),
});
