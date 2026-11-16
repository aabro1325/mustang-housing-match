// Headed check of the unpacked extension on real listing searches.
// Saves screenshots under /opt/cursor/artifacts and prints a short result per site.
// Does not print page bodies or any API key.
import { chromium } from "@playwright/test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const outDir = process.env.LIVE_OUT || "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const SEARCHES = [
  { site: "zillow", url: "https://www.zillow.com/san-luis-obispo-ca/rentals/" },
  { site: "apartments", url: "https://www.apartments.com/san-luis-obispo-ca/" },
  { site: "craigslist", url: "https://slo.craigslist.org/search/apa" },
  { site: "redfin", url: "https://www.redfin.com/city/17010/CA/San-Luis-Obispo/apartments-for-rent" },
];

function listingLink(site, href) {
  try {
    const u = new URL(href);
    const path = u.pathname;
    if (site === "zillow" && (/\/homedetails\/.+\/\d+_zpid\b/.test(path) || /^\/apartments\/[^/]+\/[^/]+\/[A-Za-z0-9]+/.test(path) || /^\/b\/[^/]+/.test(path))) return u.href;
    if (site === "apartments" && /^\/[a-z0-9-]+\/[a-z0-9]{5,12}\/?$/i.test(path)) return u.href;
    if (site === "craigslist" && (/^\/view\/d\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path) || /\/d\/[^/]+\/\d+\.html$/.test(path))) return u.href;
    if (site === "redfin" && /\/home\/\d+/.test(path)) return u.href;
  } catch { /* ignore */ }
  return null;
}

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "mhm-live-")), {
  headless: false,
  viewport: { width: 1280, height: 800 },
  locale: "en-US",
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, "--no-sandbox", "--disable-dev-shm-usage"],
});

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => undefined);
const extensionId = worker ? worker.url().split("/")[2] : null;
const results = [];

async function shot(page, name) {
  const path = join(outDir, name);
  await page.screenshot({ path, fullPage: false });
  return path;
}

if (!extensionId) {
  results.push({ site: "extension", ok: false, note: "service worker did not start" });
} else {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
  await panel.getByRole("button", { name: "Set my preferences" }).click();
  await panel.getByLabel("Maximum monthly budget").fill("1600");
  await panel.getByLabel("Maximum commute time").fill("20");
  await panel.getByRole("button", { name: "Save preferences" }).click();
  await shot(panel, "panel-ready.png");

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await shot(options, "options.png");
  await options.close();

  for (const search of SEARCHES) {
    const page = await context.newPage();
    const record = { site: search.site, ok: false, note: "" };
    try {
      const response = await page.goto(search.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      await shot(page, `${search.site}-search.png`);
      const status = response?.status() ?? 0;
      const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((a) => a.href)).catch(() => []);
      const listing = hrefs.map((href) => listingLink(search.site, href)).find(Boolean);
      if (!listing) {
        record.note = `no listing link (HTTP ${status}, title ${JSON.stringify(await page.title())})`;
        results.push(record);
        await page.close();
        continue;
      }
      await page.goto(listing, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3000);
      await shot(page, `${search.site}-listing.png`);
      await panel.bringToFront();
      const detected = panel.getByText("Listing detected");
      try {
        await detected.waitFor({ timeout: 8000 });
      } catch {
        record.note = "panel did not detect the listing URL";
        results.push(record);
        await page.close();
        continue;
      }
      await panel.getByRole("button", { name: "Analyze listing" }).click({ timeout: 8000 });
      await panel.getByRole("heading", { name: /Here's what we found|Tell us about the place|Couldn't read/ }).waitFor({ timeout: 10000 });
      await shot(panel, `${search.site}-panel.png`);
      const review = await panel.getByRole("heading", { name: "Here's what we found" }).count();
      const address = await panel.getByLabel("Address").inputValue().catch(() => "");
      record.ok = review > 0 && address.trim().length > 0 && !/could not be satisfied|access denied/i.test(address);
      record.note = record.ok ? "captured a listing address into the review screen" : "review opened without a usable address";
      if (record.ok) {
        const confirm = panel.getByRole("button", { name: "Analyze listing" });
        if (await confirm.isEnabled()) {
          await confirm.click();
          await panel.getByRole("heading", { name: "Commute to Cal Poly" }).waitFor({ timeout: 15000 });
          await shot(panel, `${search.site}-scorecard.png`);
        }
      }
    } catch (e) {
      record.note = e instanceof Error ? e.message.split("\n")[0] : "failed";
    }
    results.push(record);
    await page.close().catch(() => {});
  }
  await panel.close();
}

await context.close();
writeFileSync(join(outDir, "live-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
