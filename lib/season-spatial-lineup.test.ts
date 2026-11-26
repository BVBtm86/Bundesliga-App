import assert from "node:assert/strict";
import test from "node:test";
import { aggregateSpatialLineup, type LineupEvent, type LineupRow } from "./season-spatial-lineup";

const positions=["GK","DC","DC","DC","DMR","DML","MC","MC","AMC","AMC","FW"];
const key=positions.join("-");
const lineups:LineupRow[]=[1,2,3].flatMap(game_id=>positions.map((starting_position,index)=>({
  game_id,starting_position,starting_lineup:true,player_id:game_id===3&&index===10?12:index+1,minutes_played:index===1?60:90
})));
const events=new Map<number,LineupEvent[]>([[1,[
  {id:1,teamId:1,playerId:1,recipientId:2,category:"passing",passSuccessful:true,period:"FirstHalf",minute:10,x:10,y:50},
  {id:2,teamId:1,playerId:2,period:"FirstHalf",minute:10,x:20,y:50},
  {id:3,teamId:1,playerId:2,type:"SubstitutionOff",period:"SecondHalf",minute:60},
  {id:4,teamId:1,playerId:1,recipientId:2,category:"passing",passSuccessful:true,period:"SecondHalf",minute:70,x:14,y:50}
]]]);
const fixture={
  team:1,period:"ft",formations:[1,2,3].map(game_id=>({game_id,formation:"3-4-2-1",positions:key})),
  templates:[{formation_key:key,positions:positions.map((position,index)=>({position,x:index*8,y:position==="DMR"?89:position==="DML"?11:50}))}],
  lineups,events
};

test("most common XI is an actual repeated formation and role combination",()=>{
  const result=aggregateSpatialLineup({...fixture,mode:"lineup"});
  assert.equal(result.lineup.lineupCount,2);
  assert.equal(result.lineup.formationCount,3);
  assert.equal(result.markers.length,11);
  assert.equal(result.markers.filter(marker=>marker.position==="GK").length,1);
  assert.equal(result.markers.find(marker=>marker.position==="DMR")?.x,89);
  assert.equal(result.markers.find(marker=>marker.position==="DML")?.x,11);
  assert.ok(!result.markers.some(marker=>marker.key==="12"));
});

test("the same XI is selected when some players lack event positions",()=>{
  const nominal=aggregateSpatialLineup({...fixture,mode:"lineup"});
  const average=aggregateSpatialLineup({...fixture,mode:"average"});
  assert.equal(new Set(nominal.markers.map(marker=>marker.key)).size,11);
  assert.equal(average.lineup.selectedPlayers,11);
  assert.deepEqual(average.markers.map(marker=>marker.key),["1","2"]);
  assert.equal(average.markers[0].y,88);
});

test("network excludes the pass after the recipient was substituted",()=>{
  const network=aggregateSpatialLineup({...fixture,mode:"network"});
  assert.deepEqual(network.edges,[{from:1,to:2,count:1,confirmed:1,estimated:0,sharedMinutes:60}]);
  assert.deepEqual(network.markers.find(marker=>marker.key==="1")?.passOutcomes,{known:2,completed:2});
});


test("a more frequently repeated XI in a less-used formation is excluded",()=>{
  const formations=[
    ...fixture.formations,{game_id:4,formation:"3-4-2-1",positions:key},
    ...[5,6,7].map(game_id=>({game_id,formation:"4-2-3-1",positions:key}))
  ];
  const firstXI=lineups.filter(row=>row.game_id===1);
  const fourth=firstXI.map(row=>({...row,game_id:4,player_id:row.player_id+12}));
  const alternate=firstXI.flatMap(row=>[5,6,7].map(game_id=>({...row,game_id,player_id:row.player_id+40})));
  const result=aggregateSpatialLineup({...fixture,mode:"lineup",formations,lineups:[...lineups,...fourth,...alternate]});
  assert.equal(result.lineup.formation,"3-4-2-1");
  assert.equal(result.lineup.formationCount,4);
  assert.equal(result.lineup.formationMatches,7);
  assert.equal(result.lineup.scopedMatches,4);
  assert.equal(result.lineup.lineupCount,2);
  assert.ok(result.markers.every(marker=>Number(marker.key)<20));
});


test("the minutes XI uses recorded roles and leaves the nominal Starting Lineup on the common XI",()=>{
  const sample={...fixture,lineups:lineups.map(row=>row.player_id===11?{...row,minutes_played:5}:row)};
  const starting=aggregateSpatialLineup({...sample,mode:"lineup",selection:"minutes"});
  assert.ok(starting.markers.some(marker=>marker.key==="11"&&marker.position==="FW"));
  assert.ok(!starting.markers.some(marker=>marker.key==="12"));
  const alternate={id:1,teamId:1,playerId:12,period:"FirstHalf",minute:1,x:90,y:50};
  const withAlternate={...sample,events:new Map([...events,[3,[alternate]] as const])};
  for(const mode of ["average","network"]){
    const minutes=aggregateSpatialLineup({...withAlternate,mode,selection:"minutes"});
    assert.ok(minutes.markers.some(marker=>marker.key==="12"&&marker.position==="FW"));
    assert.equal(minutes.lineup.selectedPlayers,11);
  }
});
