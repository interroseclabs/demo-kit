import { createRequire } from "node:module";

// viteMajor is the major version of the Vite the app builds with: Vite 8 bundles with Rolldown,
// whose option for one chunk is named otherwise than Rollup's.
function viteMajor(): number {
  try {
    const { version } = createRequire(`${process.cwd()}/`)("vite/package.json") as { version: string };
    return Number(version.split(".")[0]);
  } catch {
    return 8;
  }
}

// demoBuild is the Vite config a demo build needs, to spread into the app's own: one script and
// one stylesheet, with every image and font inlined, which `demo-kit package` then inlines with
// the recording into one page that opens from a file. A page opened from a file loads no other
// script: a browser refuses a module script from file://.
//
//   export default defineConfig({ plugins: [react()], ...demoBuild({ input: "demo.html" }) });
export function demoBuild({ input = "demo.html", outDir = "dist-demo" }: { input?: string; outDir?: string } = {}) {
  const bundle =
    viteMajor() >= 8 ? { rolldownOptions: { input, output: { codeSplitting: false } } } : { rollupOptions: { input, output: { inlineDynamicImports: true } } };
  return {
    base: "./",
    build: {
      outDir,
      emptyOutDir: true,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      cssCodeSplit: false,
      modulePreload: false,
      chunkSizeWarningLimit: 1 << 14,
      ...bundle,
    },
  };
}
