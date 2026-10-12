import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Capture script: a classic self-contained IIFE injected with chrome.scripting.executeScript({ files }).
// Its completion value (the last expression) is returned to the side panel as the InjectionResult.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2022",
    minify: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./src/capture/capture.ts", import.meta.url)),
      output: {
        entryFileNames: "capture.js",
        format: "iife",
        // The bundle stores its result on a global; this footer reads and clears it so that the script's
        // completion value (what executeScript returns) is the capture result.
        footer: "(() => { const r = globalThis.__mhmCapture; delete globalThis.__mhmCapture; return r; })();",
      },
    },
  },
});
