import {test,expect} from "@playwright/test";

test("positional history matches the evolution matrix and keeps only a full-width line chart",async({page,isMobile})=>{
 test.setTimeout(120000);
 const spatialRequests:URL[]=[];page.on("request",request=>{if(request.url().includes("/api/team-spatial?"))spatialRequests.push(new URL(request.url()));});
 await page.goto("/teams");
 await page.locator(".team-directory-card").first().click();
 await page.getByRole("tab",{name:"Season Evolution",exact:true}).click();
 const workspace=page.locator(".season-evolution-workspace");
 await workspace.getByRole("navigation",{name:"Season Evolution analytical sections"}).getByRole("button",{name:"Spatial Analysis",exact:true}).click();
 await expect(workspace.getByRole("combobox",{name:"From matchday",exact:true})).toHaveCount(0);
 await expect(workspace.getByRole("combobox",{name:"To matchday",exact:true})).toHaveCount(0);
 const basis=workspace.getByRole("combobox",{name:"Spatial comparison basis",exact:true});
 await expect(basis.locator("option")).toHaveText(["Same Stage","Season"]);
 await expect(basis).toHaveValue("stage");
 if(!isMobile){const rows=await workspace.locator(".spatial-parent-filters select").evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().y));expect(rows).toHaveLength(5);expect(Math.max(...rows)-Math.min(...rows)).toBeLessThan(1);}

 await workspace.getByRole("tab",{name:"Event Heatmaps",exact:true}).click();
 await expect.poll(()=>spatialRequests.filter(url=>url.searchParams.get("mode")==="events"&&url.searchParams.get("basis")==="stage").length).toBeGreaterThanOrEqual(2);
 const urls=spatialRequests.filter(url=>url.searchParams.get("mode")==="events"&&url.searchParams.get("basis")==="stage").slice(-2);
 const samples=await Promise.all(urls.map(async url=>{const response=await page.request.get(url.toString());expect(response.ok()).toBe(true);return response.json();}));
 expect(samples[0].eligible).toBeGreaterThan(0);expect(samples[0].eligible).toBe(samples[1].eligible);
 await basis.selectOption("perMatch");
 await expect.poll(()=>spatialRequests.some(url=>url.searchParams.get("basis")==="perMatch")).toBe(true);
 await workspace.getByRole("tab",{name:"Positional Analysis",exact:true}).click();
 const channels=workspace.getByRole("group",{name:"Positional Analysis views"}).getByRole("button",{name:"Attacking Channels",exact:true});
 if(!isMobile){const before=await channels.evaluate(node=>getComputedStyle(node).backgroundColor);await channels.hover();await expect.poll(()=>channels.evaluate(node=>getComputedStyle(node).backgroundColor)).not.toBe(before);}

 for(const mode of ["Territorial Distribution","Attacking Channels"]) {
  await workspace.getByRole("group",{name:"Positional Analysis views"}).getByRole("button",{name:mode,exact:true}).click();
  const matrix=workspace.getByRole("region",{name:"Historical spatial matrix",exact:true});
  await expect(matrix).toBeVisible({timeout:90000});
  const headers=await matrix.locator("thead th").allTextContents();
  expect(headers.length).toBeGreaterThan(18);
  expect(headers.slice(-2)).toEqual(["Trend","Vs historical avg"]);
  expect(headers).not.toContain("Historical avg");
  const years=headers.slice(1,-2).map(value=>parseInt(value));
  expect(years).toEqual([...years].sort((a,b)=>b-a));
  await expect(matrix.locator(".research-trend-cell svg")).toHaveCount(0);
  await expect(workspace.getByRole("heading",{name:"Spatial Distribution Evolution",exact:true})).toHaveCount(0);
  const line=workspace.locator(".spatial-historical-line");
  await expect(line).toBeVisible();
  const parent=await workspace.locator(".spatial-historical-charts").boundingBox(),box=await line.boundingBox();
  expect(Math.abs(parent!.width-box!.width)).toBeLessThan(2);
  const last=matrix.locator("tbody tr").last(),label=await last.locator("th").innerText();
  await last.locator("td").first().click();
  await expect(line.getByRole("img",{name:`${label} across seasons`,exact:true})).toBeVisible();
 }
});
