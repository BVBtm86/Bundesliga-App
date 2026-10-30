import { test } from "node:test";
import assert from "node:assert/strict";
import { completed, goalSummary, standings, goalTrend, leagueTrend } from "./analytics";
import type { Match } from "./types";
const match = (overrides: Partial<Match> = {}): Match => ({
 id:1,date:"2025-01-01T12:00:00.000Z",week:1,homeId:1,awayId:2,home:"Bayern",away:"Dortmund",
 homeGoals:2,awayGoals:1,finished:true,venue:"Arena",attendance:null,...overrides
});
test("standings award points, goals and reverse the away result", () => {
 const teams = standings([match(),match({id:2,homeGoals:0,awayGoals:0,week:2})]);
 assert.equal(teams[0].points,4); assert.equal(teams[0].gf,2);
 assert.deepEqual(teams[0].form,["W","D"]);
 assert.equal(teams[1].points,1); assert.equal(teams[1].ga,2);
});
test("unfinished or absent scores are excluded, zero goals remain valid", () => {
 const games = [match({homeGoals:null}),match({finished:false}),match({homeGoals:0,awayGoals:0})];
 assert.equal(completed(games).length,1);
 assert.equal(goalSummary(games).average,0);
});
test("goal totals and averages use completed match scores", () => {
 const games = [match(),match({id:2,homeGoals:1,awayGoals:1})];
 assert.deepEqual(goalSummary(games),{played:2,goals:5,average:2.5});
});
test("form follows match date, even when input is newest first", () => {
 const teams = standings([match({id:2,date:"2025-02-01",homeGoals:0,awayGoals:1}),match()]);
 assert.deepEqual(teams.find(t=>t.id===1)!.form,["W","L"]);
});
test("trend orders numeric matchweeks and empty input remains finite", () => {
 assert.deepEqual(goalTrend([match({week:10}),match({week:2})]).map(w=>w.week),[2,10]);
 assert.equal(goalSummary([]).average,0);
 assert.deepEqual(standings([]),[]);
});
test("league trends count fixtures once and aggregate pass completion from totals", () => {
 const games=[match({id:1,week:1}),match({id:2,week:1,homeGoals:0,awayGoals:0})];
 const stats=[
  {gameId:1,teamId:1,shots:null,onTarget:null,possession:null,passes:null,passCompletion:null,periods:{ft:{goals:2,shots:10,onTarget:5,possession:50,passes:100,completedPasses:80,passCompletion:80}}},
  {gameId:1,teamId:2,shots:null,onTarget:null,possession:null,passes:null,passCompletion:null,periods:{ft:{goals:1,shots:8,onTarget:3,possession:50,passes:50,completedPasses:45,passCompletion:90}}},
  {gameId:2,teamId:1,shots:null,onTarget:null,possession:null,passes:null,passCompletion:null,periods:{ft:{goals:0,shots:7,onTarget:2,possession:55,passes:50,completedPasses:25,passCompletion:50}}},
  {gameId:2,teamId:2,shots:null,onTarget:null,possession:null,passes:null,passCompletion:null,periods:{ft:{goals:0,shots:9,onTarget:4,possession:45,passes:100,completedPasses:90,passCompletion:90}}},
 ];
 assert.equal(leagueTrend(games,stats,"goals")[0].value,1.5);
 assert.equal(leagueTrend(games,stats,"shotsOnTarget")[0].value,7);
 assert.equal(leagueTrend(games,stats,"passCompletion")[0].value,80);
});
test("league trends average yellow cards and committed fouls per completed match", () => {
 const games=[match({id:1,week:1}),match({id:2,week:1,homeGoals:0,awayGoals:0})];
 const stats=[
  {gameId:1,teamId:1,periods:{ft:{yellowCards:2,foulsCommitted:11}}},
  {gameId:1,teamId:2,periods:{ft:{yellowCards:1,foulsCommitted:8}}},
  {gameId:2,teamId:1,periods:{ft:{yellowCards:0,foulsCommitted:9}}},
  {gameId:2,teamId:2,periods:{ft:{yellowCards:3,foulsCommitted:12}}},
 ] as any;
 assert.equal(leagueTrend(games,stats,"yellowCards")[0].value,3);
 assert.equal(leagueTrend(games,stats,"fouls")[0].value,20);
});
test("yellow-card and foul trend points are unavailable when a team statistic is missing", () => {
 const games=[match({id:1,week:1})];
 const stats=[{gameId:1,teamId:1,periods:{ft:{yellowCards:2,foulsCommitted:5}}}] as any;
 assert.equal(leagueTrend(games,stats,"yellowCards")[0].value,null);
 assert.equal(leagueTrend(games,stats,"fouls")[0].value,null);
});

test("historical goal-ratio rules rank tied points correctly", () => {
 const games = [
  match({id:1,homeId:1,awayId:2,home:"A",away:"B",homeGoals:2,awayGoals:0}),
  match({id:2,homeId:2,awayId:3,home:"B",away:"C",homeGoals:2,awayGoals:0}),
  match({id:3,homeId:3,awayId:1,home:"C",away:"A",homeGoals:1,awayGoals:0}),
 ];
 const table = standings(games,"all",games,2,["points","goal_ratio"]);
 assert.deepEqual(table.map(team=>team.id),[1,2,3]);
});

test("modern goal difference and goals scored rules are applied in order", () => {
 const games = [
  match({id:1,homeId:1,awayId:2,home:"A",away:"B",homeGoals:2,awayGoals:0}),
  match({id:2,homeId:2,awayId:3,home:"B",away:"C",homeGoals:1,awayGoals:0}),
  match({id:3,homeId:3,awayId:1,home:"C",away:"A",homeGoals:1,awayGoals:0}),
 ];
 const table = standings(games,"all",games,3,["points","goal_difference","goals_scored"]);
 assert.deepEqual(table.map(team=>team.id),[1,3,2]);
});

test("head-to-head points separate a two-team tie", () => {
 const games = [
  match({id:1,homeId:1,awayId:2,home:"A",away:"B",homeGoals:1,awayGoals:0}),
  match({id:2,homeId:1,awayId:3,home:"A",away:"C",homeGoals:0,awayGoals:1}),
  match({id:3,homeId:2,awayId:3,home:"B",away:"C",homeGoals:2,awayGoals:0}),
 ];
 const table = standings(games,"all",games,3,["points","head_to_head_points"]);
 assert.deepEqual(table.map(team=>team.id),[1,2,3]);
});

test("head-to-head mini-table handles a three-team tie without using outside clubs", () => {
 const games = [
  match({id:1,homeId:1,awayId:2,home:"A",away:"B",homeGoals:1,awayGoals:0}),
  match({id:2,homeId:2,awayId:3,home:"B",away:"C",homeGoals:1,awayGoals:0}),
  match({id:3,homeId:3,awayId:1,home:"C",away:"A",homeGoals:1,awayGoals:0}),
 ];
 const table = standings(games,"all",games,3,["points","head_to_head_results"]);
 assert.equal(table.length,3);
 assert.equal(table.every(team=>team.rankingStatus === "tied"),true);
});

test("unresolved configured play-offs remain explicit", () => {
 const games = [match({id:1,homeGoals:0,awayGoals:0})];
 const table = standings(games,"all",games,3,["points","goal_difference","playoff"]);
 assert.equal(table.every(team=>team.rankingStatus === "playoff_required"),true);
});

test("preserves earned points and applies a configured deduction once", () => {
 const games = [match({id:1,homeId:10,awayId:20,home:"Dynamo Dresden",away:"Opponent",homeGoals:1,awayGoals:0})];
 const table = standings(games,"all",games,3,["points","goal_difference","goals_scored"],1,{points_adjustments:[{teamId:10,points:-4,reason:"disciplinary deduction"}]});
 const dynamo = table.find(team => team.id === 10)!;
 assert.equal(dynamo.earned_points,3);
 assert.equal(dynamo.points_adjustment,-4);
 assert.equal(dynamo.official_points,-1);
 assert.equal(dynamo.points,-1);
});

test("supports the historical Frankfurt and Kaiserslautern deductions", () => {
 const frankfurt = standings([match({homeId:30,awayId:31,home:"Eintracht Frankfurt",away:"Opponent"})],"all",[],3,["points"],1,{points_adjustments:[{teamId:30,points:-2}]}).find(team => team.id === 30)!;
 const kaiserslautern = standings([match({homeId:40,awayId:41,home:"1. FC Kaiserslautern",away:"Opponent"})],"all",[],3,["points"],1,{points_adjustments:[{teamId:40,points:-3}]}).find(team => team.id === 40)!;
 assert.equal(frankfurt.earned_points,3); assert.equal(frankfurt.official_points,1);
 assert.equal(kaiserslautern.earned_points,3); assert.equal(kaiserslautern.official_points,0);
});

test("expunged record annuls only the affected club's credited record", () => {
 const games = [
  match({id:1,homeId:50,awayId:51,home:"Arminia Bielefeld",away:"Opponent A",homeGoals:2,awayGoals:0}),
  match({id:2,homeId:52,awayId:50,home:"Opponent B",away:"Arminia Bielefeld",homeGoals:1,awayGoals:1}),
 ];
 const table = standings(games,"all",games,2,["points","goal_ratio"],1,{record_adjustments:[{teamId:50,type:"expunged_record",reason:"season results expunged"}]});
 const arminia = table.find(team => team.id === 50)!;
 const opponent = table.find(team => team.id === 51)!;
 assert.equal(arminia.played,0); assert.equal(arminia.won,0); assert.equal(arminia.drawn,0);
 assert.equal(arminia.gf,0); assert.equal(arminia.ga,0); assert.equal(arminia.earned_points,0); assert.equal(arminia.official_points,0);
 assert.equal(arminia.record_adjustment,"expunged_record");
 assert.equal(opponent.played,1); assert.equal(opponent.lost,1); assert.equal(opponent.gf,0); assert.equal(opponent.ga,2);
});

