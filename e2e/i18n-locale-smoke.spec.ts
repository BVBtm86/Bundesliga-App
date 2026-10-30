import { test, expect } from "@playwright/test";

test("language selector renders native labels and Romanian diacritics", async ({ page }) => {
  await page.goto("/results");
  const trigger = page.getByRole("button", { name: "Language", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Language" });
  await expect(dialog).toContainText("English");
  await expect(dialog).toContainText("Deutsch");
  await expect(dialog).toContainText("Español");
  await expect(dialog).toContainText("Română");
  await dialog.getByRole("button", { name: "Română", exact: true }).click();
  await expect(page.getByRole("button", { name: "Limbă", exact: true })).toBeVisible();
  const roDialog = page.locator(".settings-popover");
  await expect(roDialog).toContainText("Română");
  await page.reload();
  await expect(page.getByRole("button", { name: "Limbă", exact: true })).toBeVisible();
});
