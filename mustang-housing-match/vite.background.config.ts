import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Service worker: one ES module chunk, static imports only.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: {
      input: fileURLToPath(new URL("./src/background/service-worker.ts", import.meta.url)),
      output: { entryFileNames: "background.js", format: "es", codeSplitting: false },
    },
  },
});
