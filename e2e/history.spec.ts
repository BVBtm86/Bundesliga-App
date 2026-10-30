import { test, expect } from "@playwright/test";

test("historical atlas renders its BKG map and controls", async ({ page }) => {
  await page.goto("/history");
  await expect(page.locator(".history-page")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".history-controls select")).toBeVisible();
  await expect(page.locator(".history-map-card")).toBeVisible();
  await expect(page.getByRole("img", { name: "Germany divided into federal states" })).toBeVisible();
  await expect(page.locator(".history-state").first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: "All time" }).click();
  await expect.poll(() => page.locator(".history-club").count()).toBeGreaterThanOrEqual(3);
});

test("renders verified 1963/64 season outcomes", async ({ page }) => {
  await page.goto("/history");
  await expect(page.locator(".history-page")).toBeVisible({ timeout: 15000 });
  const seasonSelect = page.locator(".history-controls select").first();
  const historicalOption = seasonSelect.locator("option").filter({ hasText: "1963" }).first();
  await seasonSelect.selectOption(await historicalOption.getAttribute("value") ?? "");
  await expect(page.locator(".history-champion")).toContainText("1. FC Köln");
  await expect(page.locator(".history-outcome-groups:not(.history-relegated-groups)")).toContainText("European Cup");
  await expect(page.locator(".history-outcome-groups:not(.history-relegated-groups)")).toContainText("1860 München");
  await expect(page.locator(".history-relegated-groups")).toContainText("Preußen Münster");
  await expect(page.locator(".history-season-kpis")).toContainText("16");
  await expect(page.locator(".history-season-kpis")).toContainText("240");
  await expect(page.locator(".history-season-kpis")).toContainText("30");
  await expect(page.locator(".history-standing-row")).toHaveCount(0);
});
