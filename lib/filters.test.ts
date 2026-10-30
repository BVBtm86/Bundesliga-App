
import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonSubset, scoresForPeriod, statsForPeriod, teamVenueMatches } from "./filters";
import { completed, standings, goalSummary, goalTrend } from "./analytics";
import type { Match, MatchStats, PeriodStats } from "./types";
const match=(extra:Partial<Match>={}):Match=>({id:1,date:"2024-01-01",week:1,homeId:1,awayId:2,home:"A",away:"B",homeGoals:3,awayGoals:2,finished:true,venue:"Arena",attendance:0,...extra});
const period=(goals:number|null):PeriodStats=>({goals,shots:5,onTarget:2,possession:.5,passes:100,passCompletion:.8});
const stats=(teamId:number,goals:number|null):MatchStats=>({gameId:1,teamId,shots:10,onTarget:4,possession:.5,passes:200,passCompletion:.8,periods:{fh:period(goals),m_1_15:period(goals)}});
test("season halves split at matchdays 17 and 18 without overlap",()=>{
 const games=[match({week:0}),match({week:1}),match({week:17}),match({week:18}),match({week:34})];
 assert.deepEqual(seasonSubset(games,"first").map(m=>m.week),[1,17]);
 assert.deepEqual(seasonSubset(games,"second").map(m=>m.week),[18,34]);
});
test("period scores preserve zero and never reuse full-time goals",()=>{
 const games=scoresForPeriod([match()],[stats(1,0),stats(2,1)],"fh");
 assert.equal(games[0].homeGoals,0);assert.equal(games[0].awayGoals,1);
 assert.equal(completed(games).length,1);assert.equal(match().homeGoals,3);
});
test("missing period scores remain unknown and excluded",()=>{
 const games=scoresForPeriod([match()],[stats(1,0)],"fh");
 assert.equal(games[0].awayGoals,null);assert.equal(goalSummary(games).played,0);
 assert.equal(statsForPeriod(stats(1,1),"sh"),null);
 assert.equal(scoresForPeriod([match()],[],"ft")[0].homeGoals,3);
});
test("minute windows use their own recorded goals",()=>{
 const rows=[stats(1,2),stats(2,0)];
 assert.deepEqual(scoresForPeriod([match()],rows,"m_1_15").map(m=>[m.homeGoals,m.awayGoals]),[[2,0]]);
 assert.equal(scoresForPeriod([match()],rows,"m_16_30")[0].homeGoals,null);
});
test("venue standings keep every club while recording only selected sides",()=>{
 const games=[match(),match({id:2,homeId:2,awayId:1,home:"B",away:"A",homeGoals:0,awayGoals:1})];
 const home=standings(games,"home",games),away=standings(games,"away",games);
 assert.equal(home.length,2);assert.equal(home.find(t=>t.id===1)!.played,1);
 assert.equal(home.find(t=>t.id===1)!.points,3);assert.equal(away.find(t=>t.id===1)!.points,3);
 const unknown=scoresForPeriod(games,[],"fh");
 assert.equal(standings(unknown,"all",games).length,2);
 assert.equal(standings(unknown,"all",games).every(t=>t.played===0),true);
});
test("team venue filters follow the selected club",()=>{
 const games=[match(),match({id:2,homeId:2,awayId:1,home:"B",away:"A"})];
 assert.deepEqual(teamVenueMatches(games,1,"home").map(m=>m.id),[1]);
 assert.deepEqual(teamVenueMatches(games,1,"away").map(m=>m.id),[2]);
 assert.equal(teamVenueMatches(games,1,"all").length,2);
});
test("goal summaries and trends use the requested venue perspective",()=>{
 assert.equal(goalSummary([match()],"home").goals,3);assert.equal(goalSummary([match()],"away").goals,2);
 assert.equal(goalTrend([match()],"home")[0].average,3);
});

test("upcoming and results default to the next and latest fixture dates",async()=>{
 const {defaultMatchday,fixturesForMode}=await import("./filters");
 const games=[
  match({id:1,week:3,date:"2026-10-18",finished:true}),
  match({id:2,week:8,date:"2026-10-17",finished:true}),
  match({id:3,week:9,date:"2026-10-25",finished:false,homeGoals:null,awayGoals:null}),
  match({id:4,week:4,date:"2026-10-21",finished:false,homeGoals:null,awayGoals:null}),
  match({id:5,week:10,date:"",finished:false,homeGoals:null,awayGoals:null})
 ];
 assert.equal(defaultMatchday(games,"results"),3);
 assert.equal(defaultMatchday(games,"upcoming"),4);
 assert.deepEqual(fixturesForMode(games,"upcoming").map(m=>m.id),[4,3,5]);
 assert.deepEqual(fixturesForMode(games,"results").map(m=>m.id),[1,2]);
 assert.equal(defaultMatchday(games.filter(m=>m.finished),"upcoming"),null);
 assert.equal(defaultMatchday([],"results"),null);
});
