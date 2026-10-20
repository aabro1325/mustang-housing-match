import { defineConfig } from "@playwright/test";

// Alpha build loaded from dist-alpha/ (see npm run e2e:alpha). The full suite ignores alpha.spec.ts.
export default defineConfig({
  testDir: "e2e",
  testMatch: "alpha.spec.ts",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "retain-on-failure", viewport: { width: 420, height: 900 } },
  webServer: {
    command: "npx vite preview --outDir e2e/fixtures --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
  },
});
