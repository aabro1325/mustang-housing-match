import { test, expect, panelUrl } from "./extension";

// Fixture/local build. Two saved listings → status, note, tour, finalists → Compare → Group's First Choice.
test("decide on saved listings: status, notes, tour, compare, group's first choice", async ({ context, extensionId }) => {
  const listingPage = await context.newPage();
  await listingPage.goto("http://localhost:4173/zillow-home.html?mhm-source=zillow&kind=home");
  await expect(listingPage).toHaveTitle(/.+/);

  const panel = await context.newPage();
  await panel.goto(panelUrl(extensionId));
  await panel.getByRole("button", { name: "Set my preferences" }).click();
  await panel.getByLabel("Maximum monthly budget").fill("1450");
  await panel.getByRole("button", { name: "Save preferences" }).click();

  // First listing: the Zillow fixture.
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("heading", { name: "Here's what we found" })).toBeVisible();
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await panel.getByRole("button", { name: "Save listing" }).click();
  await expect(panel.getByText(/Saved to My housing list/)).toBeVisible();

  // Second listing: a Manual Listing from an unsupported page.
  const other = await context.newPage();
  await other.goto("http://localhost:4173/");
  await panel.bringToFront();
  await panel.getByRole("button", { name: "Analyze another listing" }).click();
  await expect(panel.getByText(/isn't a supported listing/)).toBeVisible();
  await panel.getByRole("button", { name: "Add listing manually" }).click();
  await panel.getByLabel("Address").fill("124 Hathway Ave, San Luis Obispo");
  await panel.getByLabel("Monthly rent").fill("1320");
  await panel.getByLabel("Bedrooms").fill("4");
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await panel.getByRole("button", { name: "Save listing" }).click();
  await expect(panel.getByText(/Saved to My housing list/)).toBeVisible();

  // Saved tab: open Foothill, set status, add a note, set a tour, mark finalist.
  await panel.getByRole("tab", { name: "Saved" }).click();
  const foothill = panel.getByRole("article", { name: /870 Foothill Blvd/ });
  const hathway = panel.getByRole("article", { name: /124 Hathway Ave/ });
  await expect(foothill).toBeVisible();
  await expect(hathway).toBeVisible();
  await foothill.getByRole("button", { name: /870 Foothill Blvd/ }).first().click();
  await expect(panel.getByRole("heading", { name: /870 Foothill Blvd/ })).toBeVisible();

  await panel.getByRole("radio", { name: "Considering" }).click();
  await expect(panel.getByRole("radio", { name: "Considering" })).toHaveAttribute("aria-checked", "true");

  await panel.getByLabel("New note").fill("Great light in the living room; ask about the water heater.");
  await panel.getByRole("button", { name: "Add note" }).click();
  await expect(panel.getByText("Great light in the living room; ask about the water heater.")).toBeVisible();
  await expect(panel.getByText("Me", { exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "Add a tour date" }).click();
  await panel.getByLabel("Tour date and time").fill("2026-10-20T17:00");
  await panel.getByRole("button", { name: "Save tour" }).click();
  await expect(panel.getByText(/^Tour: .*Oct 20.*5:00 PM/)).toBeVisible();
  await panel.getByRole("button", { name: "Mark as Tour scheduled" }).click();
  await expect(panel.getByRole("radio", { name: "Tour scheduled" })).toHaveAttribute("aria-checked", "true");

  await panel.getByLabel("New question").fill("Is the deposit refundable?");
  await panel.getByRole("button", { name: "Add question" }).click();
  await expect(panel.getByText("Is the deposit refundable?")).toBeVisible();

  await panel.getByRole("button", { name: "Add to Compare" }).click();
  await expect(panel.getByRole("button", { name: "In Compare" })).toBeVisible();
  await panel.screenshot({ path: "test-results/saved-detail.png", fullPage: true });
  await panel.getByRole("button", { name: "← Back to saved" }).click();
  await expect(foothill.getByText("Tour scheduled")).toBeVisible();

  // Compare needs a second finalist.
  await panel.getByRole("tab", { name: "Compare" }).click();
  await expect(panel.getByText("One finalist so far")).toBeVisible();
  await panel.getByRole("tab", { name: "Saved" }).click();
  await hathway.getByRole("button", { name: /124 Hathway Ave/ }).first().click();
  await panel.getByRole("button", { name: "Add to Compare" }).click();
  await expect(panel.getByRole("button", { name: "In Compare" })).toBeVisible();
  await panel.getByRole("button", { name: "← Back to saved" }).click();

  await panel.getByRole("tab", { name: "Compare" }).click();
  await expect(panel.getByText("2-listing comparison")).toBeVisible();
  const strip = panel.getByRole("list", { name: "Finalists" });
  await expect(strip.getByText(/870 Foothill Blvd/)).toBeVisible();
  await expect(strip.getByText(/124 Hathway Ave/)).toBeVisible();
  await expect(panel.getByRole("table", { name: "Total cost, not just rent" })).toBeVisible();
  await expect(panel.getByText("Estimated total / month")).toBeVisible();
  await panel.screenshot({ path: "test-results/compare.png", fullPage: true });

  // Roommates: the group's first choice sets Selected on exactly one listing.
  await panel.getByRole("button", { name: "Review with roommates" }).click();
  await expect(panel.getByRole("heading", { name: /One shortlist\. One voice\./ })).toBeVisible();
  await expect(panel.getByText("Recommended to explore")).toBeVisible();
  await panel.getByRole("button", { name: "Save as Group's First Choice" }).click();
  await expect(panel.getByRole("button", { name: "Group's first choice ✓" })).toBeVisible();
  await expect(panel.getByText(/is the group's first choice\./)).toBeVisible();
  await panel.screenshot({ path: "test-results/groupfit.png", fullPage: true });

  await panel.getByRole("tab", { name: "Saved" }).click();
  await expect(panel.getByRole("article").filter({ hasText: /Selected/ })).toHaveCount(1);
});
