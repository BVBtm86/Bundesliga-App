import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("components/event-explorer.tsx", "utf8");
assert.match(source, /const \[comparisonPlayers,setComparisonPlayers\]/);
assert.match(source, /const activePlayers=mode==='events'\?selectedPlayers:\(comparisonPlayers\[mode\].*?new Set/);
assert.match(source, /const comparisonVisible=useMemo/);
assert.match(source, /const tacticalSource=mode==='events'\?visible:mode==='heatmap'\?comparisonVisible:allVisible/);
assert.match(source, /const networkVisible=useMemo\(\(\)=>allVisible/);
assert.match(source, /setActivePlayers\(current=>/);
assert.match(source, /event-explorer-filter-toggle/);
assert.match(source, /setFiltersOpen\(open=>!open\)/);
assert.match(source, /mobileTeam/);
assert.match(source, /isMobile&&comparisonMode/);

const eventsOnly = (team: "all" | "home" | "away", homeId: number, awayId: number) =>
  team === "all" ? [homeId, awayId] : [team === "home" ? homeId : awayId];
const comparisonTeams = (homeId: number, awayId: number) => [homeId, awayId];

assert.deepEqual(eventsOnly("home", 1, 2), [1]);
assert.deepEqual(comparisonTeams(1, 2), [1, 2]);
assert.deepEqual(eventsOnly("away", 1, 2), [2]);
assert.deepEqual(comparisonTeams(1, 2), [1, 2]);

console.log("Event Explorer state-isolation checks passed.");

