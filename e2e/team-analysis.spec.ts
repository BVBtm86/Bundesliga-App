import { test, expect } from "@playwright/test";
import { ALL_TEAM_ANALYSIS_CATEGORIES, TEAM_ANALYSIS_METRICS } from "../components/team-analysis-metrics";

test("team directory opens the phase-one team analysis workspace", async ({ page, isMobile }) => {
  test.setTimeout(90000);
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
  const mainTabs = ["Overview", "Performance", "Team Comparison", "Season Evolution", "Forecast"];
  await expect(page.getByRole("tablist", {name:"Team analysis sections"}).getByRole("tab")).toHaveText(mainTabs);
  for (const label of mainTabs.slice(1)) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.locator(".team-analysis-tab-content:visible")).toBeVisible();
    if (label === "Performance") {
      await expect(page.locator(".team-analysis-scatter")).toHaveCount(0);
      await expect(page.locator(".team-analysis-shared-filters select")).toHaveCount(4);
      await expect(page.locator(".team-analysis-statistical-performance")).toBeVisible();
      await expect(page.locator(".team-analysis-trend-y-axis span")).toHaveCount(5);
      await expect(page.locator(".team-analysis-tab-content .team-analysis-trend")).toBeVisible();
      const trendPoint = page.locator(".team-analysis-trend-point").first();
      if (await trendPoint.count()) {
        await trendPoint.hover();
        await expect(page.locator(".team-analysis-trend-tooltip")).toBeVisible();
        await page.locator(".team-analysis-trend").hover({ position: { x: 2, y: 2 } });
        await expect(page.locator(".team-analysis-trend-tooltip")).toHaveCount(0);
      }
      const trend = page.locator(".team-analysis-tab-content .team-analysis-trend");
      const mode = trend.getByLabel("Trend mode");
      await mode.selectOption("rolling");
      await expect(trend.locator(".team-analysis-trend-line-overlay path")).toHaveCount(2);
      await expect(trend.locator(".team-analysis-trend-line-overlay path.for")).toHaveAttribute("d", /L/);
      await trend.locator(".team-analysis-trend-point").first().focus();
      await expect(trend.locator(".team-analysis-trend-tooltip")).toBeVisible();

      await mode.selectOption("cumulative");
      await expect(trend.locator(".team-analysis-trend-line-overlay")).toHaveCount(0);
      await expect(trend.locator(".team-analysis-trend-bars .for").first()).toBeVisible();
      await trend.getByLabel("Metric").selectOption("shotAccuracy");
      await expect(mode.locator('option[value="cumulative"]')).toHaveCount(0);
      await expect(mode).toHaveValue("perMatch");
      await expect(trend.locator(".team-analysis-trend-y-title")).toContainText("(%)");
      await page.getByRole("tab", { name: "Possession", exact: true }).click();
      await expect(mode.locator('option[value="cumulative"]')).toHaveCount(0);
      await page.getByRole("tab", { name: "Defending", exact: true }).click();
      await mode.selectOption("rolling");
      await trend.getByLabel("Metric").selectOption("tackles");
      const axis = trend.locator(".team-analysis-trend-y-axis span");
      await expect.poll(async () => Number(await axis.first().innerText())).toBeGreaterThan(0);
      await expect.poll(async () => Number(await axis.last().innerText())).toBeGreaterThan(0);
      const tackleTicks = await axis.allTextContents();
      await trend.getByLabel("Metric").selectOption("interceptions");
      await expect.poll(() => axis.allTextContents()).not.toEqual(tackleTicks);
      await mode.selectOption("perMatch");
      await expect(trend.locator(".team-analysis-trend-line-overlay")).toHaveCount(0);
    }
    if (label === "Tactical Analysis") {
      await expect(page.getByRole("heading", { name: "Coming soon", exact: true })).toBeVisible();
      await expect(page.getByText("Advanced statistics and machine learning are planned for Tactical Analysis.")).toBeVisible();
      await expect(page.locator(".team-analysis-subtabs")).toHaveCount(0);
      await expect(page.locator(".team-analysis-advanced-metric, .team-analysis-finding")).toHaveCount(0);
    }
    if (label === "Season Evolution") {
      const evolution=page.locator(".season-evolution-workspace");
      const nav=evolution.getByRole("navigation",{name:"Season Evolution analytical sections"});
      await expect(nav.getByRole("button")).toHaveText(["Summary","Evolution","Spatial Analysis","Tactical Analysis"]);
      await nav.getByRole("button",{name:"Evolution",exact:true}).click();
      const matrix=evolution.getByRole("region",{name:"Historical statistical matrix",exact:true});
      await expect(matrix).toBeVisible({timeout:45000});
      await expect(matrix.locator("thead th").last()).toHaveText("Vs historical avg");
      await expect(matrix.getByRole("columnheader",{name:"Trend",exact:true})).toBeVisible();
      await matrix.getByRole("button",{name:"Goals",exact:true}).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(evolution.getByRole("heading",{name:"Season Comparison",exact:true})).toBeVisible();
    }
    if (label === "Team Comparison") {
      await expect(page.getByRole("heading", {name:"Head-to-Head Comparison",exact:true})).toBeVisible();
      await expect(page.locator(".statistics-league-chart .team-analysis-scatter")).toBeVisible();
      await expect(page.getByRole("complementary").locator("[data-insight-type=team-comparison-statistics]")).toBeVisible();
      await expect(page.getByRole("navigation", {name:"Comparison categories"}).getByRole("button")).toHaveCount(ALL_TEAM_ANALYSIS_CATEGORIES.length);
      const benchmark = page.locator(".matchup-metrics");
      await expect(benchmark.locator(".club-benchmark-reference")).toHaveCount(TEAM_ANALYSIS_METRICS.attacking.length);
      await expect(benchmark.locator(".club-benchmark-reference").first()).toHaveCSS("left", /px$/);
      await expect(benchmark.locator(".club-benchmark-value").first()).toContainText(/#\d+\/\d+/);
      await expect(benchmark.locator(".club-benchmark-value").first()).toHaveAttribute("title", /League index .+average = 100/);
      const to = page.getByLabel("To matchday", {exact:true});
      await expect(page.getByLabel("From matchday", {exact:true})).toHaveValue("1");
      await expect(to).toHaveValue(await to.locator("option").last().innerText());
      const relativeDetails=page.locator(".matchup-relative details");
      await expect(relativeDetails).not.toHaveAttribute("open", "");
      await page.getByText("Relative Differences", {exact:true}).click();
      await expect(relativeDetails.locator("tbody tr")).toHaveCount(TEAM_ANALYSIS_METRICS.attacking.length);
      const detailTable=relativeDetails.locator("table");
      await expect(detailTable.getByRole("columnheader")).toHaveCount(4);
      await expect(detailTable.getByRole("columnheader", {name:/vs Bundesliga/})).toHaveCount(2);
      await expect(detailTable.locator("tbody th").first()).toHaveText("Goals");
      await expect(detailTable.getByRole("row").filter({hasText:"Shot accuracy"}).getByRole("cell").first()).toHaveAttribute("title", /pp$/);
      await detailTable.getByRole("button", {name:"Metric",exact:true}).click();
      await expect(detailTable.getByRole("columnheader", {name:/Metric/})).toHaveAttribute("aria-sort","ascending");
      const [csv] = await Promise.all([page.waitForEvent("download"),page.getByRole("button", {name:"Export CSV"}).click()]);
      expect(csv.suggestedFilename()).toBe("bundesliga-team-comparison.csv");
      const categories=page.getByRole("navigation",{name:"Comparison categories"});
      for(const category of ["Defending","Passing","Possession","Discipline","Goalkeeping"]){
        await categories.getByRole("button",{name:category,exact:true}).click();
        const alignment=await benchmark.evaluate(panel=>{
          const header=panel.querySelector(".benchmark-relative-legend i")!.getBoundingClientRect().left;
          return Array.from(panel.querySelectorAll(".club-benchmark-reference")).every(line=>Math.abs(line.getBoundingClientRect().left-header)<1);
        });
        expect(alignment).toBe(true);
      }
      await categories.getByRole("button",{name:"Attacking",exact:true}).click();

      await expect(page.locator(".team-analysis-scatter")).toBeVisible();
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
      await expect(page.locator(".scatter-selected-label")).toHaveCount(0);
      await expect(page.locator(".team-analysis-scatter")).toHaveCount(1);
      await expect(page.locator(".scatter-crest.comparison-primary")).toHaveCount(1);
      await expect(page.locator(".scatter-crest.comparison-secondary")).toHaveCount(1);
      const crest = page.locator(".scatter-crest.league-context").first();
      await expect(crest).toHaveCSS("opacity", "0.42");
      if (isMobile) await crest.tap();
      else await crest.focus();
      await expect(page.locator(".team-analysis-scatter-tooltip")).toBeVisible();
      await expect(crest).toHaveCSS("opacity", "1");

      await expect(page.getByRole("button", { name: "Expand chart", exact: true })).toHaveCount(0);

      const teamA = page.getByLabel("First club", { exact: true });
      const teamB = page.getByLabel("Second club", { exact: true });
      const selectedTeam = await teamA.inputValue();
      const otherTeam = await teamB.inputValue();
      await expect(teamB.locator(`option[value="${selectedTeam}"]`)).toHaveCount(0);
      await expect(teamB).not.toHaveValue(selectedTeam);
      await page.getByRole("button", {name:"Swap teams",exact:true}).click();
      await expect(teamA).toHaveValue(otherTeam);
      await expect(teamB).toHaveValue(selectedTeam);
      await expect(page.locator(".team-analysis-scatter")).toHaveCount(1);
      await expect(page.getByLabel("Scatterplot reference season")).toHaveCount(0);

      const sharedSeason = page.locator(".team-analysis-season select");
      const previousSeason = await sharedSeason.inputValue();
      await expect(page.locator(".comparison-selection header")).toContainText(previousSeason.replace("-", "/"));
      const nextSeason = await sharedSeason.locator("option").nth(1).getAttribute("value");
      if (nextSeason) {
        await sharedSeason.selectOption(nextSeason);
        await expect(page.locator(".comparison-selection header")).toContainText(nextSeason.replace("-", "/"));
        await expect(page.getByRole("heading", {name:"Head-to-Head Comparison",exact:true})).toBeVisible();
      }
      await page.getByRole("button", {name:"Spatial Analysis",exact:true}).click();
      await expect(page.getByRole("heading", {name:"Spatial Analysis",exact:true})).toBeVisible();
      await expect(page.locator(".team-analysis-scatter")).toBeHidden();
      await expect(page.getByLabel("Comparison mode")).toHaveCount(0);
      await expect(page.getByText("Shared scale · Event frequency (per match)")).toBeVisible();
      const pitches = page.locator(".spatial-comparison figure");
      await expect(pitches).toHaveCount(2);
      await expect(pitches.locator("figcaption img")).toHaveCount(2);
      await expect(pitches.locator(".heatmap-overlay")).toHaveCount(2);
      await expect(pitches.locator(".spatial-pitch-caption")).toHaveCount(0);
      const densityTip = page.getByRole("tooltip",{includeHidden:true});
      await expect(densityTip).toBeHidden();
      await page.getByRole("button",{name:"About density normalization"}).focus();
      await expect(densityTip).toBeVisible();
      await expect(densityTip).toContainText("per covered match");
      if (!isMobile) {
        const pitchTop = (await pitches.first().boundingBox())?.y;
        const insightsTop = (await page.getByRole("region",{name:"Spatial insights"}).boundingBox())?.y;
        expect(insightsTop).toBeCloseTo(pitchTop!, 0);
        const controlTops = await page.locator(".spatial-common-filters select").evaluateAll(controls =>
          controls.map(control => control.getBoundingClientRect().top));
        expect(Math.max(...controlTops)-Math.min(...controlTops)).toBeLessThan(1);
      }
      await expect(pitches.first().locator("figcaption .sr-only")).toContainText(/matches covered.*plotted events/);
      await page.getByLabel("Density normalization",{exact:true}).selectOption("distribution");
      await expect(page.getByText("Shared scale · Spatial distribution (%)")).toBeVisible();
      await expect(page.getByRole("region",{name:"Spatial insights"})).toBeVisible();
      const formationTable = page.getByRole("table", {name:"Recorded starting formations"});
      await expect(formationTable).toHaveCount(0);
      const visualization = page.getByRole("tablist", {name:"Spatial visualization",exact:true});
      await visualization.getByRole("tab",{name:"Starting Lineup",exact:true}).click();
      await expect(page.getByLabel("Lineup selection")).toHaveCount(0);
      await expect(pitches.first().locator(".spatial-event-marker")).toHaveCount(11);
      const players = () => pitches.first().locator(".spatial-event-marker").evaluateAll(nodes =>
        nodes.map(node => node.getAttribute("aria-label")).sort());
      await expect(formationTable).toBeVisible();
      await expect(pitches.first().locator(".spatial-pitch-caption")).toHaveText(/^\d(?:-\d)+$/);
      await expect(pitches.first().getByText(/roles filled|Incomplete coverage/)).toHaveCount(0);
      await visualization.getByRole("tab",{name:"Average Positions",exact:true}).click();
      await expect(page.getByLabel("Lineup selection")).toHaveCount(0);
      await expect(formationTable).toHaveCount(0);
      await expect(pitches.first().locator(".spatial-event-marker")).toHaveCount(11);
      const minutesXI = await players();
      const marker = pitches.first().locator(".spatial-event-marker").first();
      await marker.focus();
      const details = page.getByRole("tooltip", {name:"Spatial details",exact:true});
      await expect(details.getByText("Recorded events",{exact:true})).toBeVisible();
      await expect(details.getByText("Average event coordinates",{exact:true})).toHaveCount(0);
      await expect(marker.locator("title")).toHaveCount(0);
      await marker.press("Enter");
      await expect(marker).toHaveAttribute("aria-pressed","true");
      await visualization.getByRole("tab",{name:"Passing Networks",exact:true}).click();
      await expect(formationTable).toHaveCount(0);
      await expect(page.getByLabel("Minimum completed passes")).toHaveCount(0);
      await expect(pitches.first().locator(".spatial-event-marker")).toHaveCount(11);
      expect(await players()).toEqual(minutesXI);
      const connection = pitches.first().locator(".spatial-network-edge").first();
      await expect(connection).toBeVisible();
      await expect(connection.locator(".spatial-pass-link")).toHaveAttribute("stroke-linecap","round");
      await expect(connection.locator(".spatial-pass-link")).not.toHaveAttribute("stroke-dasharray",/.+/);
      await connection.focus();
      await expect(pitches.first().locator(".spatial-event-marker.connected")).toHaveCount(2);
      await expect(pitches.first().locator(".spatial-network-edge.muted").first()).toBeVisible();
      await expect(details.getByText(/shared minutes/)).toBeVisible();
      await expect(pitches.first().locator("figcaption .sr-only")).toContainText(/confirmed, .* inferred passes/);
      const selectedPlayer = pitches.first().locator(".spatial-event-marker").first();
      await selectedPlayer.scrollIntoViewIfNeeded();
      const stage = page.locator(".spatial-stage");
      const svg = await pitches.first().locator("svg[aria-label]").elementHandle();
      const pitchBounds = await pitches.first().locator(".spatial-comparison-pitch").boundingBox();
      const stageBefore = await stage.boundingBox();
      const scrollBefore = await page.evaluate(() => window.scrollY);
      let spatialRequests = 0;
      const trackSpatial = (request: {url():string}) => { if (request.url().includes("/api/team-spatial?")) spatialRequests++; };
      page.on("request", trackSpatial);
      await selectedPlayer.press("Enter");
      await expect(selectedPlayer).toHaveAttribute("aria-pressed","true");
      await expect(selectedPlayer.locator(".spatial-player-ring")).toHaveCount(1);
      await expect(details.getByText("Completed passes to XI",{exact:true})).toBeVisible();
      await expect(details.getByText("Passes received from XI",{exact:true})).toBeVisible();
      await expect(details.getByRole("heading",{name:"Top five recipients"})).toBeVisible();
      await expect(details.getByRole("heading",{name:"Top five passers"})).toHaveCount(1);
      await expect(details.getByText("Pass completion",{exact:true})).toBeVisible();
      await expect(pitches.nth(1).locator(".spatial-network-edge.muted")).toHaveCount(0);
      expect(await pitches.first().locator(".spatial-comparison-pitch").boundingBox()).toEqual(pitchBounds);
      expect(await stage.boundingBox()).toEqual(stageBefore);
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
      expect(await svg?.evaluate(node => node.isConnected)).toBe(true);
      expect(spatialRequests).toBe(0);
      page.off("request", trackSpatial);
      await pitches.first().locator("svg[aria-label]").click({position:{x:5,y:5}});
      await expect(selectedPlayer).toHaveAttribute("aria-pressed","false");
      await expect(page.getByLabel("Lineup selection")).toHaveCount(0);
      await expect(pitches.first().locator(".spatial-event-marker")).toHaveCount(11);
      await visualization.getByRole("tab",{name:"Starting Lineup",exact:true}).click();
      await expect(page.getByLabel("Lineup selection")).toHaveCount(0);
      await visualization.getByRole("tab",{name:"Shot Analysis",exact:true}).click();
      await expect(pitches.first().locator(".spatial-shot-marker").first()).toBeVisible();
      await expect(page.getByLabel("Shot outcomes")).toContainText("Saved");
      await pitches.first().locator(".spatial-shot-marker").first().focus();
      await expect(details).toBeVisible();
      await expect(page.getByRole("combobox",{name:"Pitch view",exact:true})).toHaveCount(0);
      await expect(pitches.getByText(/^0 shots outside the attacking half$/)).toHaveCount(0);
      const outcomes=page.getByRole("group",{name:"Shot outcomes",exact:true});
      await expect(outcomes.locator('button[aria-pressed="true"]')).toHaveCount(5);
      await outcomes.getByRole("button",{name:"Saved",exact:true}).click();
      await outcomes.getByRole("button",{name:"Missed",exact:true}).click();
      await expect(outcomes.locator('button[aria-pressed="true"]')).toHaveCount(3);
      const shotView=page.getByRole("combobox",{name:"Shot view",exact:true});
      await expect(shotView.locator("option")).toHaveCount(2);
      await shotView.selectOption("mouth");
      await expect(outcomes.locator('button[aria-pressed="true"]')).toHaveCount(3);
      await expect(pitches.locator(".spatial-goal-frame")).toHaveCount(2);
      await expect(pitches.getByText("Attack ↑")).toHaveCount(0);
      await expect(pitches.getByText(/^0 valid destinations outside the goal view$/)).toHaveCount(0);
      await pitches.first().locator(".spatial-shot-marker").first().focus();
      await expect(details).toBeVisible();
      await page.getByRole("button", {name:"Statistics",exact:true}).click();
      await expect(page.getByRole("heading", {name:"Head-to-Head Comparison",exact:true})).toBeVisible();
      await expect(page.locator(".team-analysis-scatter")).toBeVisible();
      await expect(page.locator(".spatial-comparison")).toBeHidden();
    }
  }
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.locator(".team-analysis-recent")).toHaveCount(0);
  await expect(page.locator(".insights-placeholder[data-insight-type=team-analysis]")).toBeVisible();
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


test("analytical layers share navigation and retain selections", async ({page})=>{
  test.setTimeout(120000);
  await page.goto("/teams");
  await page.locator(".team-directory-card").first().click();
  const main=page.getByRole("tablist",{name:"Team analysis sections"});
  await expect(main.getByRole("tab")).toHaveText(["Overview","Performance","Team Comparison","Season Evolution","Forecast"]);
  for(const section of ["Team Comparison","Season Evolution"]) {
    await main.getByRole("tab",{name:section,exact:true}).click();
    const nav=page.getByRole("navigation",{name:`${section} analytical sections`});
    await expect(nav.getByRole("button")).toHaveText(section==="Team Comparison"?["Statistics","Spatial Analysis","Tactical Analysis"]:["Summary","Evolution","Spatial Analysis","Tactical Analysis"]);
    const boxes=await nav.getByRole("button").evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {y:b.y,width:b.width,height:b.height};}));
    expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(1);
    expect(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))).toBeLessThan(1);
    const workspace=page.locator(section==="Team Comparison"?".same-season-comparison":".season-evolution-workspace");
    const filter=section==="Team Comparison"?workspace.getByLabel("Second club",{exact:true}):workspace.locator(".historical-filters select");
    await expect(filter).toBeVisible();
    const value=await filter.inputValue();
    await nav.getByRole("button",{name:"Tactical Analysis",exact:true}).click();
    await expect(workspace.getByRole("status")).toHaveText("Tactical intelligence is planned for a future release.");
    await main.getByRole("tab",{name:"Overview",exact:true}).click();
    await main.getByRole("tab",{name:section,exact:true}).click();
    await expect(nav.getByRole("button",{name:"Tactical Analysis",exact:true})).toHaveAttribute("aria-pressed","true");
    await nav.getByRole("button",{name:section==="Team Comparison"?"Statistics":"Summary",exact:true}).click();
    await expect(filter).toHaveValue(value);
  }
});
