import { test as base, chromium, type BrowserContext } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const distDir = process.env.E2E_DIST
  ? fileURLToPath(new URL(process.env.E2E_DIST, import.meta.url))
  : fileURLToPath(new URL("../dist", import.meta.url));

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), "mhm-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");
    await use(worker.url().split("/")[2]!);
  },
});

export const expect = test.expect;

export function panelUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/sidepanel/index.html`;
}
