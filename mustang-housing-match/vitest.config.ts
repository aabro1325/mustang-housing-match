import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [preact()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    projects: [
      { extends: true, test: { name: "node", include: ["src/**/*.test.{ts,tsx}"], exclude: ["src/sidepanel/**"], environment: "node" } },
      { extends: true, test: { name: "dom", include: ["src/sidepanel/**/*.test.{ts,tsx}"], environment: "happy-dom" } },
    ],
  },
});
