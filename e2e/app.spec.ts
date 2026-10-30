
import { test, expect } from "@playwright/test";
import type { Dashboard } from "../lib/types";

async function load(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByLabel("Season",{exact:true})).toBeEnabled();
  await page.getByLabel("Season",{exact:true}).selectOption("2009-2010");
  await expect(page.locator(".page-footer")).toContainText("2009-2010");
  await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("34");
  await expect(page.locator(".match-row").first()).toBeVisible();
}
async function navigate(page: import("@playwright/test").Page,name:string) {
  await page.locator(".sidebar nav:visible, .mobile-nav:visible").getByRole("button",{name,exact:true}).click();
}
test("latest matchday dashboard has the four requested summaries and fits the screen",async ({page,request},info)=>{
  await load(page);
  const data:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  const games=data.matches.filter(m=>m.week===34&&m.finished);
  const goals=games.reduce((sum,m)=>sum+m.homeGoals!+m.awayGoals!,0);
  const reported=games.filter(m=>m.attendance!==null);
  const average=reported.reduce((sum,m)=>sum+m.attendance!,0)/reported.length;
  const homeWins=games.filter(m=>m.homeGoals!>m.awayGoals!).length;
  const draws=games.filter(m=>m.homeGoals===m.awayGoals).length;
  const losses=games.length-homeWins-draws;
  const values=page.locator(".metric-card > strong");
  await expect(values.nth(0)).toHaveText(goals.toLocaleString("en-GB"));
  await expect(values.nth(1)).toHaveText((goals/games.length).toFixed(2));
  await expect(values.nth(2)).toHaveText(Math.round(average).toLocaleString("en-GB"));
  await expect(values.nth(3)).toHaveText(homeWins+" – "+draws+" – "+losses);
  await expect(page.locator(".match-row")).toHaveCount(9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);

  const chart=await page.locator(".trend-wide").boundingBox();
  const grid=await page.locator(".dashboard-grid").boundingBox();
  expect(chart).not.toBeNull();expect(grid).not.toBeNull();
  expect(Math.abs(chart!.width-grid!.width)).toBeLessThan(2);
  expect(chart!.y).toBeGreaterThanOrEqual(grid!.y+grid!.height);
  await page.screenshot({path:info.outputPath(info.project.name+"-overview.png"),fullPage:true});
});
test("match details show actual stats and support keyboard dismissal",async ({page})=>{
  await load(page);
  await page.locator(".match-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".comparison")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("club search combines with the selected matchday",async ({page})=>{
  await load(page);
  await navigate(page,"Matches");
  await page.getByLabel("Matchday",{exact:true}).selectOption("1");
  await expect(page.locator(".match-row")).toHaveCount(9);
  await page.getByLabel("Search clubs").fill("Bayern");
  await expect(page.locator(".match-row")).toHaveCount(1);
  await page.getByLabel("Search clubs").fill("not-a-club");
  await expect(page.getByText("No matches match these filters.")).toBeVisible();
  await page.getByRole("button",{name:"Clear filters",exact:true}).click();
  await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("34");
  await expect(page.locator(".match-row")).toHaveCount(9);
});

test("team cards show the club's full played season and clearing restores the matchday",async ({page,request})=>{
  await load(page);
  await page.getByLabel("Matchday",{exact:true}).selectOption("2");
  await navigate(page,"Teams");
  await expect(page.locator(".team-card")).toHaveCount(18);
  const name=await page.locator(".team-card h3").first().innerText();
  const data:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  const team=data.teams.find(t=>t.name===name)!;
  const games=data.matches.filter(m=>m.finished&&(m.homeId===team.id||m.awayId===team.id));
  const goals=games.reduce((sum,m)=>sum+m.homeGoals!+m.awayGoals!,0);
  await page.locator(".team-card").first().click();
  await expect(page.locator(".match-row")).toHaveCount(34);
  await expect(page.locator(".history-fixture-meta")).toHaveCount(34);
  await expect(page.getByLabel("Matchday",{exact:true})).toHaveCount(0);
  await expect(page.locator(".history-scope")).toHaveText("All played matches");
  await expect(page.locator(".matches-panel .match-range")).toContainText("34 played matches");
  await expect(page.locator(".metric-card > strong").first()).toHaveText(goals.toLocaleString("en-GB"));
  await expect(page.locator(".metric-card").nth(3)).toContainText("Team W–D–L");
  await expect(page.locator(".metric-card > strong").nth(3)).toHaveText(team.won+" – "+team.drawn+" – "+team.lost);
  await page.getByRole("button",{name:"Refresh imported data"}).click();
  await expect(page.getByRole("button",{name:"Refresh imported data"})).toBeEnabled();
  await expect(page.locator(".match-row")).toHaveCount(34);
  await page.getByRole("button",{name:"Clear team filter"}).click();
  await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("2");
  await expect(page.locator(".match-row")).toHaveCount(9);
});

test("scoring trends show actual goal counts without over-under or prediction content",async ({page})=>{
  await load(page);
  await expect(page.locator("body")).not.toContainText(/over.?under|predictions|odds/i);
  await navigate(page,"Goal trends");
  await expect(page.locator(".goal-bucket")).toHaveCount(6);
  const counts=await page.locator(".bucket-count").allTextContents();
  expect(counts.reduce((sum,count)=>sum+Number(count),0)).toBe(9);
  await expect(page.locator(".histogram-note")).toContainText("on matchday 34");
  const chart=await page.locator(".trend-wide").boundingBox();
  const grid=await page.locator(".dashboard-grid").boundingBox();
  expect(chart).not.toBeNull();expect(grid).not.toBeNull();
  expect(Math.abs(chart!.width-grid!.width)).toBeLessThan(2);
  expect(chart!.y).toBeGreaterThanOrEqual(grid!.y+grid!.height);

  await expect(page.locator("body")).not.toContainText(/over.?under|predictions|odds/i);
});
test("connection failure has a working retry",async ({page})=>{
  await page.route("**/api/dashboard*",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Database unavailable for connection test."})}));
  await page.goto("/");
  await expect(page.getByText("Database unavailable for connection test.")).toBeVisible();
  await page.unroute("**/api/dashboard*");
  await page.getByRole("button",{name:"Try again"}).click();
  await expect(page.locator(".match-row").first()).toBeVisible();
});
test("API rejects malformed seasons",async ({request})=>{
  expect((await request.get("/api/dashboard?season=invalid")).status()).toBe(400);
});
test("matchday filters update goals and persist across tabs",async ({page,request})=>{
  await load(page);
  const data:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  const games=data.matches.filter(m=>m.week===2&&m.finished);
  const goals=games.reduce((sum,m)=>sum+m.homeGoals!+m.awayGoals!,0);
  await page.getByLabel("Matchday",{exact:true}).selectOption("2");
  await expect(page.locator(".metric-card > strong").first()).toHaveText(String(goals));
  await expect(page.locator(".match-row")).toHaveCount(9);
  await expect(page.getByRole("heading",{name:"Average goals by matchday",exact:true})).toBeVisible();
  await navigate(page,"Goal trends");
  await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("2");
  await expect(page.locator(".histogram-note")).toContainText("on matchday 2");
  await navigate(page,"Teams");
  await expect(page.locator(".league-panel")).toContainText("Full season");
  await expect(page.locator("tbody tr").first().locator("td").nth(2)).toHaveText("34");
  await navigate(page,"Matches");
  await expect(page.locator(".match-row")).toHaveCount(9);
});
test("matchday arrows respect boundaries and refresh keeps the selection",async ({page})=>{
  await load(page);
  const filter=page.getByLabel("Matchday",{exact:true});
  await expect(page.getByRole("button",{name:"Next matchday"})).toBeDisabled();
  await page.getByRole("button",{name:"Previous matchday"}).click();
  await expect(filter).toHaveValue("33");
  await page.getByRole("button",{name:"Refresh imported data"}).click();
  await expect(page.getByRole("button",{name:"Refresh imported data"})).toBeEnabled();
  await expect(filter).toHaveValue("33");
  await page.getByRole("button",{name:"Latest",exact:true}).click();
  await expect(filter).toHaveValue("34");
  await filter.selectOption("1");
  await expect(page.getByRole("button",{name:"Previous matchday"})).toBeDisabled();
});
test("season changes select the latest imported matchday with no full-season option",async ({page})=>{
  await load(page);
  await page.getByLabel("Matchday",{exact:true}).selectOption("3");
  await page.getByLabel("Season",{exact:true}).selectOption("2010-2011");
  await expect(page.locator(".page-footer")).toContainText("2010-2011");
  await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("34");
  await expect(page.getByLabel("Matchday",{exact:true}).locator('option[value="all"]')).toHaveCount(0);
  await expect(page.locator(".match-row")).toHaveCount(9);
});

test("fixture lists use one heading and compact dates for team history",async ({page},info)=>{
  await load(page);
  await navigate(page,"Matches");
  await expect(page.locator(".matches-panel > .panel-heading h2")).toHaveText("Matchday 34");
  await expect(page.locator(".matchday-header")).toHaveCount(0);
  await expect(page.locator(".history-fixture-meta")).toHaveCount(0);
  await expect(page.locator(".matches-panel")).not.toContainText("THE MATCH CENTRE");
  await navigate(page,"Teams");
  await page.locator(".team-card").first().click();
  await expect(page.locator(".match-row")).toHaveCount(34);
  await expect(page.locator(".history-fixture-meta")).toHaveCount(34);
  await expect(page.locator(".matchday-header")).toHaveCount(0);
  await page.screenshot({path:info.outputPath(info.project.name+"-team-history.png")});
});

test("venue details show the imported stadium and attendance",async ({page,request})=>{
  await load(page);
  const data:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  const match=data.matches.filter(m=>m.week===34)[0];
  await expect(page.locator(".fixture-stadium").first()).toContainText(match.venue);
  await page.locator(".match-row").first().click();
  await expect(page.locator(".venue-details strong")).toHaveText(match.venue);
  await expect(page.locator(".attendance-details strong")).toHaveText(match.attendance!.toLocaleString("en-GB"));
  await expect(page.locator(".venue-card .stadium-icon img")).toBeVisible();
});
test("zero attendance remains distinct from missing attendance",async ({page,request})=>{
  const payload:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  payload.matches[0].attendance=0;
  payload.matches[0].venue="";
  await page.route("**/api/dashboard*",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(payload)}));
  await page.goto("/");
  await page.locator(".match-row").first().click();
  await expect(page.locator(".attendance-details strong")).toHaveText("0");
  await expect(page.locator(".venue-details strong")).toHaveText("Venue unavailable");
  await page.getByRole("button",{name:"Close match details"}).click();
  payload.matches[0].attendance=null;
  await page.getByRole("button",{name:"Refresh imported data"}).click();
  await expect(page.getByRole("button",{name:"Refresh imported data"})).toBeEnabled();
  await page.locator(".match-row").first().click();
  await expect(page.locator(".attendance-details strong")).toHaveText("Unavailable");
});
test("attendance averages include zero and exclude unknown values while home WDL uses results",async ({page,request})=>{
  const payload:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  payload.matches=payload.matches.filter(m=>m.week===34).slice(0,3);
  payload.matches[0]={...payload.matches[0],homeGoals:2,awayGoals:0,attendance:0};
  payload.matches[1]={...payload.matches[1],homeGoals:1,awayGoals:1,attendance:100};
  payload.matches[2]={...payload.matches[2],homeGoals:0,awayGoals:1,attendance:null};
  await page.route("**/api/dashboard*",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(payload)}));
  await page.goto("/");
  await expect(page.locator(".metric-card > strong").nth(0)).toHaveText("5");
  await expect(page.locator(".metric-card > strong").nth(1)).toHaveText("1.67");
  await expect(page.locator(".metric-card > strong").nth(2)).toHaveText("50");
  await expect(page.locator(".metric-card").nth(2)).toContainText("2 of 3 matches reported");
  await expect(page.locator(".metric-card > strong").nth(3)).toHaveText("1 – 1 – 1");
});

test("standings and scorer links also open full-season team histories",async ({page})=>{
  await load(page);
  await page.locator(".club-link").first().click();
  await expect(page.locator(".match-row")).toHaveCount(34);
  await page.getByRole("button",{name:"Clear team filter"}).click();
  await navigate(page,"Goal trends");
  await page.locator(".scorers > button").first().click();
  await expect(page.locator(".match-row")).toHaveCount(34);
  await expect(page.locator(".history-scope")).toHaveText("All played matches");
});
test("team history excludes matches that have not been played",async ({page,request})=>{
  const payload:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  const team=payload.teams.find(t=>t.name==="Bayern Munich")!;
  const match=payload.matches.find(m=>m.homeId===team.id||m.awayId===team.id)!;
  match.finished=false;match.homeGoals=null;match.awayGoals=null;
  await page.route("**/api/dashboard*",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(payload)}));
  await page.goto("/");
  await expect(page.locator(".match-row").first()).toBeVisible();
  await navigate(page,"Teams");
  await page.locator(".team-card").filter({hasText:"Bayern Munich"}).click();
  await expect(page.locator(".match-row")).toHaveCount(33);
  await expect(page.locator(".matches-panel .match-range")).toContainText("33 played matches");
});

test("overview standings contain all clubs, WDL and the entire season independently of matchday",async ({page})=>{
  await load(page);
  await page.getByLabel("Matchday",{exact:true}).selectOption("1");
  await expect(page.locator(".league-panel tbody tr")).toHaveCount(18);
  await expect(page.getByRole("columnheader",{name:"W",exact:true})).toBeVisible();
  await expect(page.getByRole("columnheader",{name:"D",exact:true})).toBeVisible();
  await expect(page.getByRole("columnheader",{name:"L",exact:true})).toBeVisible();
  const cells=await page.locator(".league-panel tbody tr").first().locator("td").allTextContents();
  expect(Number(cells[2])).toBe(34);
  expect(Number(cells[3])+Number(cells[4])+Number(cells[5])).toBe(34);
  await expect(page.locator(".league-panel")).toContainText("Full season");
});
test("season-half and venue filters combine for team histories",async ({page,request})=>{
  await load(page);
  const data:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  const club=data.teams.find(t=>t.name==="Bayern Munich")!;
  const expected=(side:string)=>data.matches.filter(m=>m.finished&&m.week<=17&&(side==="home"?m.homeId===club.id:m.awayId===club.id)).length;
  await page.getByLabel("Season phase",{exact:true}).selectOption("first");
  await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("17");
  await expect(page.locator(".league-panel tbody tr").first().locator("td").nth(2)).toHaveText("17");
  await navigate(page,"Teams");
  await page.locator(".team-card").filter({hasText:"Bayern Munich"}).click();
  await expect(page.locator(".match-row")).toHaveCount(17);
  await page.getByLabel("Venue",{exact:true}).selectOption("home");
  await expect(page.locator(".match-row")).toHaveCount(expected("home"));
  await page.getByLabel("Venue",{exact:true}).selectOption("away");
  await expect(page.locator(".match-row")).toHaveCount(expected("away"));
  await page.getByLabel("Season phase",{exact:true}).selectOption("second");
  await expect(page.locator(".history-fixture-meta").first()).toContainText("MD");
  await expect(page.locator(".team-history-note")).toContainText("Second half of season");
});
test("half and minute-range filters use recorded period goals and stats",async ({page,request})=>{
  await load(page);
  const data:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  const games=data.matches.filter(m=>m.week===34&&m.finished);
  for(const period of ["fh","sh","m_1_15","m_16_30"] as const) {
    const goals=games.reduce((sum,m)=>sum+
      data.stats.find(s=>s.gameId===m.id&&s.teamId===m.homeId)!.periods![period]!.goals!+
      data.stats.find(s=>s.gameId===m.id&&s.teamId===m.awayId)!.periods![period]!.goals!,0);
    await page.getByLabel("Match period",{exact:true}).selectOption(period);
    await expect(page.locator(".metric-card > strong").first()).toHaveText(String(goals));
    await expect(page.locator(".match-row")).toHaveCount(9);
  }
  await page.getByLabel("Match period",{exact:true}).selectOption("fh");
  await page.locator(".match-row").first().click();
  await expect(page.getByRole("heading",{name:"First half comparison",exact:true})).toBeVisible();
  const match=games[0];
  const shots=data.stats.find(s=>s.gameId===match.id&&s.teamId===match.homeId)!.periods!.fh!.shots!;
  await expect(page.locator(".comparison").first().locator("strong").first()).toHaveText(String(shots));
});
test("missing period data stays unavailable rather than becoming nil-nil",async ({page,request})=>{
  const payload:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
  payload.stats=[];
  await page.route("**/api/dashboard*",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(payload)}));
  await page.goto("/");
  await expect(page.locator(".match-row").first()).toBeVisible();
  await page.getByLabel("Match period",{exact:true}).selectOption("fh");
  await expect(page.locator(".metric-card > strong").first()).toHaveText("—");
  await expect(page.locator(".match-score").first()).toHaveText("— – —");
  await expect(page.locator(".coverage-note").first()).toContainText("9 played matches");
  await expect(page.locator(".league-panel tbody tr")).toHaveCount(18);
  await expect(page.locator(".league-panel tbody tr").first().locator("td").nth(2)).toHaveText("0");
  await expect(page.locator(".metric-card > strong").nth(3)).toHaveText("—");
  await navigate(page,"Teams");
  await expect(page.locator(".team-card")).toHaveCount(18);
  await expect(page.locator(".team-cards")).not.toContainText("NaN");
});
test("home and away standings report only the selected venue records",async ({page})=>{
  await load(page);
  await page.getByLabel("Venue",{exact:true}).selectOption("home");
  await expect(page.locator(".league-panel tbody tr")).toHaveCount(18);
  await expect(page.locator(".league-panel tbody tr").first().locator("td").nth(2)).toHaveText("17");
  await expect(page.locator(".metric-card").nth(1)).toContainText("Home-team goals");
  await page.getByLabel("Venue",{exact:true}).selectOption("away");
  await expect(page.locator(".league-panel tbody tr").first().locator("td").nth(2)).toHaveText("17");
  await expect(page.locator(".metric-card").nth(3)).toContainText("Away W–D–L");
});

test("upcoming defaults to the next unplayed matchday and results defaults to the latest played",async({page,request})=>{
 const payload:Dashboard=await (await request.get("/api/dashboard?season=2009-2010")).json();
 const base=payload.matches[0];
 payload.matches=[
  {...base,id:9001,date:"2026-10-18T15:30:00Z",week:6,finished:true,homeGoals:2,awayGoals:1},
  {...base,id:9002,date:"2026-10-17T15:30:00Z",week:8,finished:true,homeGoals:1,awayGoals:0},
  {...base,id:9003,date:"2026-10-25T15:30:00Z",week:9,finished:false,homeGoals:null,awayGoals:null},
  {...base,id:9004,date:"2026-10-21T15:30:00Z",week:7,finished:false,homeGoals:null,awayGoals:null},
  {...base,id:9005,date:"2026-10-20T15:30:00Z",week:7,finished:true,homeGoals:0,awayGoals:0}
 ];
 await page.route("**/api/dashboard*",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(payload)}));
 await page.goto("/upcoming");
 await expect(page).toHaveURL(/\/upcoming$/);
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("7");
 await expect(page.locator(".match-row")).toHaveCount(1);
 await expect(page.locator(".match-score")).toHaveText("vs");
 await expect(page.locator(".history-fixture-meta")).toContainText("21 Oct 2026");
 await expect(page.locator(".metric-card")).toHaveCount(0);
 await page.getByLabel("Matchday",{exact:true}).selectOption("9");
 await page.getByRole("button",{name:"Refresh imported data"}).click();
 await expect(page.getByRole("button",{name:"Refresh imported data"})).toBeEnabled();
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("9");
 await navigate(page,"Matches");
 await expect(page).toHaveURL(/\/matches$/);
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("7");
 await expect(page.locator(".match-row")).toHaveCount(1);
 await expect(page.locator(".match-score")).toHaveText("0 – 0");
 await expect(page.locator(".metric-card")).toHaveCount(4);
 await page.getByLabel("Matchday",{exact:true}).selectOption("6");
 await navigate(page,"Matches");
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("7");
 await navigate(page,"Upcoming");
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("7");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});


test("Upcoming navigation is hidden for archived seasons and its route falls back to Matches",async({page})=>{
 await load(page);
 await expect(page.locator(".sidebar nav:visible, .mobile-nav:visible").getByRole("button",{name:"Upcoming",exact:true})).toHaveCount(0);
 await navigate(page,"Matches");
 await expect(page).toHaveURL(/\/matches$/);
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("34");
 await expect(page.locator(".fixture-mode")).toHaveCount(0);
 await page.route("**/api/dashboard*",async route=>{
  const response=await route.fetch({url:new URL("/api/dashboard?season=2009-2010",route.request().url()).href});
  await route.fulfill({response});
 });
 await page.goto("/upcoming");
 await expect(page).toHaveURL(/\/matches$/);
 await expect(page.locator(".match-row")).toHaveCount(9);
});

test("Standings has its own page and combines detailed filters for the full club roster",async({page,request})=>{
 await load(page);
 await navigate(page,"Standings");
 await expect(page).toHaveURL(/\/standings$/);
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("From matchday",{exact:true})).toHaveValue("1");
 await expect(page.getByLabel("To matchday",{exact:true})).toHaveValue("34");
 await expect(page.locator(".league-panel tbody tr")).toHaveCount(18);
 await expect(page.locator(".team-card")).toHaveCount(0);
 await expect(page.getByRole("columnheader",{name:"Pts/MP",exact:true})).toBeVisible();
 await page.getByLabel("To matchday",{exact:true}).selectOption("2");
 await page.getByLabel("Venue",{exact:true}).selectOption("home");
 await page.getByLabel("Match period",{exact:true}).selectOption("fh");
 const payload:Dashboard=await(await request.get("/api/dashboard?season=2009-2010")).json();
 const {scoresForPeriod}=await import("../lib/filters");
 const {standings}=await import("../lib/analytics");
 const selected=scoresForPeriod(payload.matches.filter(m=>m.week<=2),payload.stats,"fh");
 const expected=standings(selected,"home",payload.matches);
 await expect(page.locator(".league-panel tbody tr")).toHaveCount(18);
 await expect(page.locator(".league-panel tbody tr").first().locator("td").nth(9)).toHaveText(String(expected[0].points));
 await expect(page.locator(".league-panel .match-range")).toContainText("MD 1 to 2");
 await page.getByLabel("From matchday",{exact:true}).selectOption("18");
 await expect(page.getByLabel("To matchday",{exact:true})).toHaveValue("18");
 await page.getByRole("button",{name:"Reset standings filters",exact:true}).click();
 await expect(page.getByLabel("From matchday",{exact:true})).toHaveValue("1");
 await expect(page.getByLabel("To matchday",{exact:true})).toHaveValue("34");
 await expect(page.getByLabel("Venue",{exact:true})).toHaveValue("all");
 await expect(page.getByLabel("Match period",{exact:true})).toHaveValue("ft");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await navigate(page,"Matches");
 await expect(page.getByLabel("Season",{exact:true})).toHaveValue("2009-2010");
 await expect(page.getByLabel("Matchday",{exact:true})).toHaveValue("34");
});
