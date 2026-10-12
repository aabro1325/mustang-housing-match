import { defineConfig } from "@playwright/test";

// End-to-end tests load the unpacked build from dist/ (built with the fixture providers) into a persistent
// Chromium context. Fixture listing pages are served from e2e/fixtures/ on localhost.
export default defineConfig({
  testDir: "e2e",
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
