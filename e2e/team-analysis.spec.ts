import { test, expect } from "@playwright/test";

test("team directory opens the phase-one team analysis workspace", async ({ page }) => {
  await page.goto("/teams");
  await expect(page.locator(".team-directory-card").first()).toBeVisible({ timeout: 15000 });
  await page.locator(".team-directory-card").first().click();
  await expect(page).toHaveURL(/\/teams\/\d+$/);
  await expect(page.locator(".team-analysis-header")).toBeVisible();
  await expect(page.locator(".team-analysis-kpis")).toBeVisible();
  await expect(page.locator(".team-analysis-performance-card")).toHaveCount(2);
  const possessionRow = page.locator(".team-analysis-performance-card.for-card .team-analysis-metric-list > div").filter({ hasText: "Possession" });
  await expect(possessionRow.locator("strong")).toHaveText(/%/);
  expect(Number((await possessionRow.locator("strong").innerText()).replace("%", ""))).toBeGreaterThan(1);
  await expect(page.locator(".team-analysis-overview .team-analysis-trend")).toHaveCount(0);
      await expect(page.locator(".team-analysis-tabs button")).toHaveCount(7);
  for (const label of ["Performance", "Tactical DNA", "Strengths & Weaknesses", "Team Comparisons", "Season Evolution", "Forecast"]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.locator(".team-analysis-tab-content")).toBeVisible();
    if (label === "Performance") {
      await expect(page.locator(".team-analysis-scatter")).toBeVisible();
      await expect(page.locator(".team-analysis-shared-filters select")).toHaveCount(4);
      await expect(page.locator(".team-analysis-category-trigger")).toHaveCount(2);
      const categoryTriggers = page.locator(".team-analysis-category-trigger");
      await categoryTriggers.nth(0).click();
      await page.locator(".team-analysis-category-menu button", { hasText: "Passing" }).click();
      await categoryTriggers.nth(1).click();
      await page.locator(".team-analysis-category-menu button", { hasText: "Defending" }).click();
      await expect(page.locator(".team-analysis-statistic-trigger")).toHaveCount(2);
      await expect(page.locator(".team-analysis-statistic-trigger").first()).toContainText("For");
      await expect(page.locator(".team-analysis-scatter-legend")).toHaveCount(1);
      await expect(page.locator(".team-analysis-scatter-chart > svg")).toBeVisible();
      await expect(page.locator(".scatter-tick-label").first()).toBeVisible();
      await expect(page.locator(".team-analysis-trend-y-axis span")).toHaveCount(5);
      await expect(page.locator(".scatter-selected-label")).toHaveCount(0);
      await expect(page.locator(".team-analysis-tab-content .team-analysis-trend")).toBeVisible();
      const crest = page.locator(".scatter-crest").first();
      if (await crest.count()) {
        await expect(page.locator(".team-analysis-scatter-tooltip")).toHaveCount(0);
        await crest.hover();
        await expect(page.locator(".team-analysis-scatter-tooltip")).toBeVisible();
        await page.locator(".team-analysis-scatter-chart").hover({ position: { x: 2, y: 2 } });
        await expect(page.locator(".team-analysis-scatter-tooltip")).toHaveCount(0);
      }
      const trendPoint = page.locator(".team-analysis-trend-point").first();
      if (await trendPoint.count()) {
        await trendPoint.hover();
        await expect(page.locator(".team-analysis-trend-tooltip")).toBeVisible();
        await page.locator(".team-analysis-trend").hover({ position: { x: 2, y: 2 } });
        await expect(page.locator(".team-analysis-trend-tooltip")).toHaveCount(0);
      }
    }
  }
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.locator(".team-analysis-recent")).toHaveCount(0);
  await expect(page.locator(".team-analysis-intelligence-compact")).toBeVisible();
  const seasonSelect = page.locator(".team-analysis-season select");
  if (await seasonSelect.locator("option").count() > 1) {
    const alternate = await seasonSelect.locator("option").nth(1).getAttribute("value");
    if (alternate) {
      await seasonSelect.selectOption(alternate);
      await expect(page.locator(".team-analysis-header")).toBeVisible();
    }
  }
  await page.goto("/teams");
  await expect(page.locator(".team-directory-card").nth(1)).toBeVisible({ timeout: 15000 });
  await page.locator(".team-directory-card").nth(1).click();
  await expect(page.locator(".team-analysis-header")).toBeVisible();
});
