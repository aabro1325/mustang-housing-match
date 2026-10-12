import { test, expect, panelUrl } from "./extension";

// The panel page runs in a normal tab here (Playwright cannot open the real side panel). The panel therefore
// evaluates the most recently used http(s) tab when the active tab is an extension page (see src/chrome/tabs.ts).
test("set preferences, analyze the fixture Zillow page, see a Scorecard, save it", async ({ context, extensionId }) => {
  const listingPage = await context.newPage();
  await listingPage.goto("http://localhost:4173/zillow-home.html?mhm-source=zillow&kind=home");
  await expect(listingPage).toHaveTitle(/.+/);

  const panel = await context.newPage();
  await panel.goto(panelUrl(extensionId));
  await panel.getByRole("button", { name: "Set my preferences" }).click();
  await panel.getByLabel("Maximum monthly budget").fill("1450");
  await panel.getByRole("radio", { name: "Bike" }).click();
  await panel.getByLabel("Maximum commute time").fill("15");
  await panel.getByRole("button", { name: "Save preferences" }).click();

  await expect(panel.getByText("Listing detected")).toBeVisible();
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("heading", { name: "Here's what we found" })).toBeVisible();
  await expect(panel.getByLabel("Address")).toHaveValue(/870 Foothill Blvd/);
  await expect(panel.getByLabel("Monthly rent")).toHaveValue(/1250/);
  await panel.screenshot({ path: "test-results/review.png", fullPage: true });

  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await expect(panel.getByText(/870 Foothill Blvd/).first()).toBeVisible();
  await expect(panel.getByLabel("Bike (your mode)")).toBeVisible();
  await expect(panel.getByText(/\d+ min/).first()).toBeVisible();

  // A preference change recomputes instantly from the stored Commute.
  const scoreBefore = await panel.getByRole("img", { name: /Fit Score/ }).getAttribute("aria-label");
  await panel.getByRole("button", { name: "Change preferences" }).click();
  await panel.getByRole("radio", { name: "Walk" }).click();
  await panel.getByLabel("Maximum commute time").fill("5");
  await panel.getByRole("button", { name: "Save preferences" }).click();
  const scoreAfter = await panel.getByRole("img", { name: /Fit Score/ }).getAttribute("aria-label");
  expect(scoreAfter).not.toBe(scoreBefore);

  await panel.getByRole("button", { name: "Save listing" }).click();
  await expect(panel.getByText(/Saved to My housing list/)).toBeVisible();
  await panel.screenshot({ path: "test-results/scorecard.png", fullPage: true });
});

test("an unsupported page offers manual and text entry; manual listing scores", async ({ context, extensionId }) => {
  const other = await context.newPage();
  await other.goto("http://localhost:4173/");
  const panel = await context.newPage();
  await panel.goto(panelUrl(extensionId));
  await panel.getByRole("button", { name: "Skip for now" }).click();
  await expect(panel.getByText(/isn't a supported listing/)).toBeVisible();
  await panel.getByRole("button", { name: "Add listing manually" }).click();
  await panel.getByLabel("Address").fill("1150 Chorro St, San Luis Obispo");
  await panel.getByLabel("Monthly rent").fill("2240");
  await panel.getByLabel("Bedrooms").fill("2");
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await expect(panel.getByText("Lease length not listed; confirm the term before applying")).toBeVisible();
});
