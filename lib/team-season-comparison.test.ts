import assert from "node:assert/strict";
import test from "node:test";
import { clubSeasonTrajectory, fullScope, summarizeLeague } from "./team-season-comparison";
import { leagueIndex, relativeDeviation, symmetricDeviationLimit } from "./team-comparison-statistics";
import { eventHeatmapGrid, spatialDensityDifference } from "./spatial-density";
import type { Match, MatchStats, PeriodStats } from "./types";

const season="2025-2026";
const game=(id:number,week:number,homeId:number,awayId:number,homeGoals:number,awayGoals:number):Match=>({
  id,season,week,homeId,awayId,homeGoals,awayGoals,home:String(homeId),away:String(awayId),finished:true,
  date:`2025-09-${id+10}`,venue:"",attendance:null
});
const fields:PeriodStats={goals:null,shots:null,onTarget:null,possession:null,passes:null,passCompletion:null};
const stat=(gameId:number,teamId:number,passes:number,completedPasses:number):MatchStats=>({
  ...fields,gameId,teamId,periods:{ft:{...fields,passes,completedPasses},fh:{...fields,passes:passes/2,completedPasses:completedPasses/2}}
});
const fixtures=[game(1,1,1,2,2,0),game(2,2,2,1,1,1),game(3,2,3,4,0,0)];
const stats=[stat(1,1,40,30),stat(2,1,60,54),stat(1,2,50,40),stat(2,2,50,40)];
const fixture={season,matches:fixtures,stats};

test("league rows use paired totals, expose coverage, and exclude missing percentile values",()=>{
  const league=summarizeLeague(fixture,fullScope);
  const first=league.clubs.find(club=>club.team.id===1)!;
  const missing=league.clubs.find(club=>club.team.id===3)!;
  const accuracy=first.metrics.passAccuracy!;
  assert.equal(accuracy.value,84);
  assert.equal(accuracy.matches,2);
  assert.equal(accuracy.population,2);
  assert.equal(accuracy.average,82);
  assert.equal(accuracy.rank,1);
  assert.equal(accuracy.percentile,75);
  assert.equal(missing.metrics.passAccuracy?.value,null);
  assert.equal(first.metrics.pointsPerMatch?.value,2);
  assert.equal(first.position,1);
  assert.equal(league.ongoing,true);
});

test("home and away scopes use the selected role, and half statistics never inherit full-time standings",()=>{
  const league=summarizeLeague(fixture,{from:2,to:2,venue:"away",period:"fh"});
  const club=league.clubs.find(row=>row.team.id===1)!;
  assert.equal(club.team.played,1);
  assert.equal(club.position,null);
  assert.equal(club.metrics.pointsPerMatch?.value,null);
  assert.equal(club.metrics.goals?.value,null);
  assert.equal(club.metrics.passes?.value,30);
  assert.equal(club.metrics.passAccuracy?.value,90);
});

test("historical event metrics use only reconciled coverage and normalize half progression by exposure",()=>{
  const league=summarizeLeague(fixture,{...fullScope,period:"fh"},[
    {matchId:1,teamId:1,period:"fh",usablePasses:20,rejectedPasses:0,progressive:6,entries:4},
    {matchId:2,teamId:1,period:"fh",usablePasses:29,rejectedPasses:1,progressive:8,entries:7}
  ]);
  const first=league.clubs.find(club=>club.team.id===1)!;
  assert.equal(first.metrics.progressivePasses?.value,12);
  assert.equal(first.metrics.progressivePasses?.matches,1);
  assert.equal(first.metrics.finalThirdEntries?.value,4);
});

test("league index uses 100 as the baseline and supports zero and above-average values",()=>{
  assert.equal(leagueIndex(100,100),100);
  assert.equal(leagueIndex(120,100),120);
  assert.equal(leagueIndex(80,100),80);
  assert.equal(leagueIndex(0,100),0);
  assert.equal(Math.round(leagueIndex(555.4,501.86)!*10)/10,110.7);
  assert.equal(leagueIndex(1,0),null);
  assert.equal(leagueIndex(1,null),null);
  assert.equal(leagueIndex(undefined,1),null);
});

test("league ranks share ties and skip the next competition rank",()=>{
  const league=summarizeLeague({...fixture,stats:[...stats,stat(3,3,40,36),stat(3,4,40,36)]},fullScope);
  const rank=(id:number)=>league.clubs.find(club=>club.team.id===id)?.metrics.passAccuracy?.rank;
  assert.deepEqual([rank(3),rank(4),rank(1),rank(2)],[1,1,3,4]);
});

test("relative deviations keep their direction and share an uncapped symmetric scale",()=>{
  const deviations=[relativeDeviation(10,20),relativeDeviation(30,20),relativeDeviation(104,8),relativeDeviation(0,0)];
  assert.deepEqual(deviations,[-50,50,1200,null]);
  assert.equal(relativeDeviation(null,20),null);
  assert.equal(relativeDeviation(0,20),-100);
  assert.equal(relativeDeviation(20,20),0);
  assert.equal(symmetricDeviationLimit(deviations),1200);
  assert.equal(symmetricDeviationLimit([null,0]),25);
});

test("trajectory returns only completed scoped fixtures and paired pass totals",()=>{
  const points=clubSeasonTrajectory([...fixtures,{...game(4,3,1,2,0,0),finished:false}],stats,fullScope,1);
  assert.deepEqual(points.map(point=>point.week),[1,2]);
  assert.deepEqual(points.map(point=>point.values.pointsPerMatch),[3,1]);
  assert.deepEqual(points.map(point=>point.passing),[{numerator:30,denominator:40},{numerator:54,denominator:60}]);
  const awayHalf=clubSeasonTrajectory(fixtures,stats,{from:2,to:2,venue:"away",period:"fh"},1);
  assert.equal(awayHalf[0].values.pointsPerMatch,null);
  assert.equal(awayHalf[0].values.passAccuracy,90);
});

test("Against rates use opponents’ paired totals while preserving the selected club’s venue",()=>{
  const league=summarizeLeague(fixture,{...fullScope,venue:"away"},[],true);
  const club=league.clubs.find(row=>row.team.id===1)!;
  assert.equal(club.against?.passAccuracy?.value,80);
  assert.equal(club.against?.passAccuracy?.matches,1);
  assert.equal(club.metrics.passAccuracy?.value,90);
  assert.equal(club.against?.goals?.value,1);
});

test("matchday trajectories expose registry metrics and preserve paired rate denominators",()=>{
  const rows=stats.map((row,index)=>index<2?{...row,periods:{...row.periods,ft:{
    ...row.periods!.ft!,shots:index===0?4:8,onTarget:index===0?3:4
  }}}:row);
  const points=clubSeasonTrajectory(fixtures,rows,fullScope,1);
  assert.deepEqual(points.map(point=>point.values.shotAccuracy),[75,50]);
  assert.deepEqual(points.map(point=>point.ratios?.shotAccuracy),[{numerator:3,denominator:4},{numerator:4,denominator:8}]);
  assert.equal(points[0].values.redCards,null);
});

test("spatial differences subtract matching normalized cells and reverse on season swap",()=>{
  const {columns,rows}=eventHeatmapGrid(true);
  const baseline=Array<number>(columns*rows).fill(0);
  const comparison=[...baseline];
  baseline[0]=4;
  comparison[0]=1;
  comparison[1]=2;
  const result=spatialDensityDifference(baseline,comparison);
  const swapped=spatialDensityDifference(comparison,baseline);
  assert.deepEqual(result?.values.slice(0,3),[-3,2,0]);
  assert.deepEqual(swapped?.values.slice(0,3),[3,-2,0]);
  assert.equal(result?.max,3);
  assert.equal(swapped?.max,3);
  assert.equal(spatialDensityDifference([],comparison),null);
  assert.equal(spatialDensityDifference(baseline,baseline)?.max,0);
});
