import assert from "node:assert/strict";
import test from "node:test";
import { clubSeasonTrajectory, fullScope } from "./team-season-comparison";
import { evolutionProgressValues } from "./season-evolution-values";
import type { Match, MatchStats, PeriodStats } from "./types";
const base:PeriodStats={goals:null,shots:null,onTarget:null,possession:null,passes:null,passCompletion:null};
const match=(id:number):Match=>({id,season:"2025-2026",week:id,date:`2025-09-${String(id+10).padStart(2,"0")}T12:00:00Z`,homeId:1,awayId:2,home:"A",away:"B",homeGoals:1,awayGoals:0,finished:true,venue:"",attendance:null});
const stat=(id:number,team:number,attempts:number,completed:number):MatchStats=>({...base,gameId:id,teamId:team,periods:{ft:{...base,passes:attempts,completedPasses:completed,possession:team===1?60:40}}});
const matches=Array.from({length:6},(_,i)=>match(i+1));
const stats=matches.flatMap((m,i)=>[stat(m.id,1,i===0?10:90,i===0?10:45),stat(m.id,2,20,5)]);
const points=()=>clubSeasonTrajectory(matches,stats,fullScope,1,3,1,true);

test("season-to-date percentages pool numerators and denominators, not match percentages",()=>{
 const values=evolutionProgressValues(points(),"passAccuracy","running");
 assert.equal(values.get(2),55);
 assert.notEqual(values.get(2),75);
});
test("Against progression uses opponents' denominators and retains match roles",()=>{
 const trajectory=points();
 assert.deepEqual(trajectory[0].againstRatios?.passAccuracy,{numerator:5,denominator:20});
 assert.equal(evolutionProgressValues(trajectory,"passAccuracy","running",true).get(2),25);
 assert.equal(evolutionProgressValues(trajectory,"goals","total",true).get(2),0);
});
test("rolling rates need five matches and pool exactly the latest five",()=>{
 const values=evolutionProgressValues(points(),"passAccuracy","rolling");
 assert.equal(values.get(4),null);
 assert.equal(values.get(5),100*190/370);
 assert.equal(values.get(6),50);
});
test("missing values stay unavailable instead of zero or a misleading partial total",()=>{
 const trajectory=points();
 trajectory[1].values.shots=null;
 trajectory[0].values.shots=4;
 assert.equal(evolutionProgressValues(trajectory,"shots","total").get(2),null);
 delete trajectory[1].ratios!.passAccuracy;
 assert.equal(evolutionProgressValues(trajectory,"passAccuracy","running").get(2),null);
});
test("zero-attempt games remain valid zero exposure in a pooled rate",()=>{
 const trajectory=points();
 trajectory[0].ratios!.passAccuracy={numerator:0,denominator:0};
 assert.equal(evolutionProgressValues(trajectory,"passAccuracy","running").get(1),null);
 assert.equal(evolutionProgressValues(trajectory,"passAccuracy","running").get(2),50);
});
test("possession uses equal match exposure and cumulative percentages never sum",()=>{
 assert.equal(evolutionProgressValues(points(),"possession","running").get(2),60);
 assert.equal(evolutionProgressValues(points(),"passAccuracy","total").get(2),55);
});
test("counts support cumulative totals, averages and goal difference",()=>{
 assert.equal(evolutionProgressValues(points(),"pointsPerMatch","total").get(3),9);
 assert.equal(evolutionProgressValues(points(),"goals","running").get(3),1);
 assert.equal(evolutionProgressValues(points(),"goalDifference","total").get(3),3);
});
test("rolling windows follow actual completion dates after postponements",()=>{
 const trajectory=points();
 trajectory[0].date="2025-10-31T12:00:00Z";
 const values=evolutionProgressValues(trajectory,"pointsPerMatch","total");
 assert.equal(values.get(1),18);
 assert.equal(values.get(2),3);
});
