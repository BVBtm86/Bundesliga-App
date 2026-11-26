import {test,expect} from "@playwright/test";

for(const section of ["Team Comparison","Season Evolution"]) {
  test(`${section} has one spatial selector and shared filters`,async({page,isMobile})=>{
    test.setTimeout(120000);
    const requests:URL[]=[];
    page.on("request",request=>{if(request.url().includes("/api/spatial-distributions?"))requests.push(new URL(request.url()));});
    await page.addInitScript(()=>localStorage.setItem("bundesliga-theme","dark"));
    await page.goto("/teams");
    await page.locator(".team-directory-card").first().click();
    await page.getByRole("tab",{name:section,exact:true}).click();
    await page.getByRole("navigation",{name:`${section} analytical sections`}).getByRole("button",{name:"Spatial Analysis",exact:true}).click();
    const workspace=page.locator(section==="Team Comparison"?".same-season-comparison":".season-spatial-workspace");
    const selector=workspace.getByRole("tablist",{name:"Spatial visualization"});
    await expect(selector.getByRole("tab")).toHaveText(["Starting Lineup","Average Positions","Passing Networks","Shot Analysis","Event Heatmaps","Positional Analysis"]);
    for(const label of ["From matchday","To matchday","Venue","Match period"])await expect(workspace.getByRole("combobox",{name:label,exact:true})).toHaveCount(1);
    await workspace.getByRole("combobox",{name:"To matchday",exact:true}).selectOption("6");
    await workspace.getByRole("combobox",{name:"From matchday",exact:true}).selectOption("2");
    await workspace.getByRole("combobox",{name:"Venue",exact:true}).selectOption("home");
    await workspace.getByRole("combobox",{name:"Match period",exact:true}).selectOption("fh");
    await selector.getByRole("tab",{name:"Positional Analysis",exact:true}).click();
    await workspace.getByRole("group",{name:"Positional Analysis views"}).getByRole("button",{name:"Territorial Distribution",exact:true}).click();
    await expect(workspace.getByRole("tabpanel")).toHaveCount(1);
    await expect(workspace.locator(".spatial-comparison-figure:visible").filter({hasNot:page.locator(".distribution-pitch")})).toHaveCount(0);
    await expect(workspace.getByRole("combobox",{name:"Primary team",exact:true})).toHaveCount(0);
    await expect(workspace.getByRole("combobox",{name:"Comparison team",exact:true})).toHaveCount(0);
    await expect.poll(()=>requests.some(url=>url.searchParams.get("kind")===(section==="Team Comparison"?"teams":"history")&&url.searchParams.get("from")==="2"&&url.searchParams.get("to")==="6"&&url.searchParams.get("venue")==="home"&&url.searchParams.get("period")==="fh")).toBe(true);
    await expect(workspace.getByRole("combobox",{name:"Spatial comparison basis"})).toHaveCount(0);
    await expect(workspace.getByRole("checkbox",{name:"League benchmark"})).toHaveCount(0);
    await expect(workspace.locator(".distribution-comparison")).toHaveCount(0);
    await expect.poll(()=>requests.some(url=>url.searchParams.get("basis")==="perMatch"&&url.searchParams.get("league")==="0")).toBe(true);
    await expect(workspace.locator(".distribution-pitch-figure:visible")).toHaveCount(2,{timeout:90000});
    const firstZone=workspace.locator(".distribution-pitch-figure:visible").first().locator(".distribution-zone-overlay g rect").first();
    await expect(firstZone).toHaveAttribute("y","70");
    await expect(firstZone).toHaveAttribute("width","68");
    await page.screenshot({path:`/Users/mario_omescu/Documents/Codex/2026-11-26/refactor-the-team-analytics-navigation-to/work/${section.replaceAll(" ","-")}-${isMobile?"mobile":"desktop"}.png`,fullPage:true});
    await workspace.getByRole("combobox",{name:"For / Against"}).selectOption("against");
    await workspace.getByRole("group",{name:"Positional Analysis views"}).getByRole("button",{name:"Attacking Channels",exact:true}).click();
    await expect(workspace.getByRole("combobox",{name:"For / Against"})).toHaveValue("against");
    await expect(workspace.locator(".distribution-pitch-figure:visible")).toHaveCount(2,{timeout:90000});
    await expect(firstZone).toHaveAttribute("y","0");
    await expect(firstZone).toHaveAttribute("height","105");
    await workspace.locator(".spatial-view-insights summary").click();
    await expect(workspace.locator(".spatial-view-insights")).toContainText("Attacking channel insights are not available yet.");
    await expect(selector.getByRole("tab",{name:"Insights",exact:true})).toHaveCount(0);
    await selector.getByRole("tab",{name:"Starting Lineup",exact:true}).click();
    await expect(workspace.getByRole("tabpanel")).toHaveCount(1);
    await expect(workspace.locator(".aggregated-spatial-workspace:visible")).toHaveCount(0);
    await expect(workspace.locator(".spatial-comparison-figure:visible")).toHaveCount(2);
    await expect(workspace.getByRole("combobox",{name:"From matchday",exact:true})).toHaveValue("2");
    await expect(workspace.getByRole("combobox",{name:"Venue",exact:true})).toHaveValue("home");
    await expect(workspace.locator('[data-insight-type="team-comparison-spatial"], [data-insight-type="season-spatial-evolution"]')).toHaveCount(0);
    if(!isMobile) {
      const boxes=await workspace.locator(".spatial-comparison-figure:visible").evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width};}));
      expect(Math.abs(boxes[0].y-boxes[1].y)).toBeLessThan(1);
      expect(boxes[1].x).toBeGreaterThan(boxes[0].x+boxes[0].width);
    }
  });
}
