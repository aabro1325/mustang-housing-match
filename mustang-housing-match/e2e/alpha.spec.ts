import { test, expect, panelUrl } from "./extension";

test("alpha shows capture and fit score only", async ({ context, extensionId }) => {
  const listingPage = await context.newPage();
  await listingPage.goto("http://localhost:4173/zillow-home.html?mhm-source=zillow&kind=home");

  const panel = await context.newPage();
  await panel.goto(panelUrl(extensionId));
  await expect(panel.locator("[data-release-scope=alpha]")).toBeVisible();
  await expect(panel.getByRole("tablist")).toHaveCount(0);
  await expect(panel.getByText("shared list")).toHaveCount(0);

  await panel.getByRole("button", { name: "Set my preferences" }).click();
  await expect(panel.getByRole("radiogroup", { name: "Getting to Cal Poly" })).toBeVisible();
  await expect(panel.getByLabel("Maximum commute time")).toHaveCount(0);
  await expect(panel.getByRole("radiogroup", { name: "Commute priority" })).toHaveCount(0);
  await panel.getByLabel("Maximum monthly budget").fill("1450");
  await panel.getByRole("radio", { name: "Bike" }).click();
  await panel.getByRole("button", { name: "Save preferences" }).click();

  await expect(panel.getByText("Listing detected")).toBeVisible();
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("heading", { name: "Here's what we found" })).toBeVisible();
  await expect(panel.getByLabel("Address")).toHaveValue(/870 Foothill Blvd/);
  await expect(panel.getByLabel("Monthly rent")).toHaveValue(/1250/);
  await expect(panel.getByRole("heading", { name: "Fees and deposit" })).toHaveCount(0);

  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Why this score?" })).toBeVisible();
  await expect(panel.getByText(/Cost ·/)).toBeVisible();
  await expect(panel.getByText(/Lease ·/)).toBeVisible();
  await expect(panel.getByText(/Amenities ·/)).toBeVisible();
  await expect(panel.getByText(/Commute ·/)).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: "Commute to Cal Poly" })).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: "Estimated monthly total" })).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: "Ask the landlord" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Save listing" })).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: "Benefits and watch-outs" })).toBeVisible();

  const scoreBefore = await panel.getByRole("img", { name: /Fit Score/ }).getAttribute("aria-label");
  await panel.getByRole("button", { name: "Change preferences" }).click();
  await panel.getByRole("radio", { name: "12-month" }).click();
  await panel.getByRole("button", { name: "Save preferences" }).click();
  const scoreAfter = await panel.getByRole("img", { name: /Fit Score/ }).getAttribute("aria-label");
  expect(scoreAfter).not.toBe(scoreBefore);
});

test("alpha unsupported pages stay quiet and still accept a manual listing", async ({ context, extensionId }) => {
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
  await expect(panel.getByLabel("Deposit")).toHaveCount(0);
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await expect(panel.getByText("Lease length not listed; confirm the term before applying")).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Commute to Cal Poly" })).toHaveCount(0);
});
