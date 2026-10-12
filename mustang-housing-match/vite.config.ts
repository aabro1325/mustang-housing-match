import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

// Side panel page. The service worker and the capture script are built by their own configs so each is one
// self-contained file (MV3 forbids dynamic import() in the worker and executeScript needs a classic script).
export default defineConfig({
  plugins: [preact()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    modulePreload: false,
    rollupOptions: {
      input: { sidepanel: fileURLToPath(new URL("./src/sidepanel/index.html", import.meta.url)) },
      output: { entryFileNames: "assets/[name]-[hash].js", chunkFileNames: "assets/[name]-[hash].js" },
    },
  },
});
