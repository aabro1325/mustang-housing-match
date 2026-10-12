import { test, expect, panelUrl } from "./extension";

// Fixture/local build: the local sharing provider keeps lists in chrome.storage.local, so joining is single-browser.
test("save a listing, see it on Saved, manage a list on Roommates", async ({ context, extensionId }) => {
  const listingPage = await context.newPage();
  await listingPage.goto("http://localhost:4173/zillow-home.html?mhm-source=zillow&kind=home");
  await expect(listingPage).toHaveTitle(/.+/);

  const panel = await context.newPage();
  await panel.goto(panelUrl(extensionId));
  await panel.getByRole("button", { name: "Set my preferences" }).click();
  await panel.getByLabel("Maximum monthly budget").fill("1450");
  await panel.getByRole("button", { name: "Save preferences" }).click();
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("heading", { name: "Here's what we found" })).toBeVisible();
  await panel.getByRole("button", { name: "Analyze listing" }).click();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await panel.getByRole("button", { name: "Save listing" }).click();
  await expect(panel.getByText(/Saved to My housing list/)).toBeVisible();

  // Saved tab: the card shows the score tag, the address, and leads to a read-only Scorecard.
  await panel.getByRole("tab", { name: "Saved" }).click();
  await expect(panel.getByRole("heading", { name: "All your finds, one place" })).toBeVisible();
  const card = panel.getByRole("article", { name: /870 Foothill Blvd/ });
  await expect(card).toBeVisible();
  await expect(card.getByText(/\d+ · (Strong|Solid|Weak) match/)).toBeVisible();
  await expect(card.getByText("Saved", { exact: true })).toBeVisible();
  await panel.screenshot({ path: "test-results/saved.png", fullPage: true });
  await card.getByRole("button", { name: /870 Foothill Blvd/ }).first().click();
  await expect(panel.getByText("Saved listing")).toBeVisible();
  await expect(panel.getByRole("img", { name: /Fit Score \d+ out of 100/ })).toBeVisible();
  await panel.getByRole("button", { name: "← Back to saved" }).click();

  // Remove with confirmation → empty state.
  await card.getByRole("button", { name: /^Remove 870/ }).click();
  await card.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(panel.getByText("Nothing saved yet")).toBeVisible();

  // Roommates: the default list exists; start another, become its owner, read the invitation code.
  await panel.getByRole("tab", { name: "Roommates" }).click();
  await expect(panel.getByRole("heading", { name: "My housing list" })).toBeVisible();
  await panel.getByRole("button", { name: "Start another list" }).click();
  await panel.getByLabel("List name").fill("Fall house");
  await panel.getByLabel("Your name").fill("Maya");
  await panel.getByRole("button", { name: "Create list" }).click();
  await expect(panel.getByRole("heading", { name: "Fall house" })).toBeVisible();
  await expect(panel.getByText("Maya (you)")).toBeVisible();
  await expect(panel.getByText("Owner")).toBeVisible();
  const code = await panel.getByLabel("Invitation code").inputValue();
  expect(code).toMatch(/^[0-9a-f-]+\.[0-9a-f]{64}$/);
  await panel.screenshot({ path: "test-results/roommates.png", fullPage: true });

  // The Saved tab now follows the new (empty) list and offers to switch.
  await panel.getByRole("tab", { name: "Saved" }).click();
  await expect(panel.getByLabel("Switch list")).toHaveValue(/.+/);
  await expect(panel.getByText("Nothing saved yet")).toBeVisible();
});
