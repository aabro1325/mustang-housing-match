import { test, expect, panelUrl } from "./extension";

test("side panel opens with four tabs", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(panelUrl(extensionId));
  await expect(page.getByRole("tab", { name: "Match" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Saved" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Compare" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Roommates" })).toBeVisible();
  await page.getByRole("tab", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "All your finds, one place" })).toBeVisible();
});
