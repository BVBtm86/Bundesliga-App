import test from "node:test";
import assert from "node:assert/strict";
import {addZones,aggregatePositionalEvents,attackingEvent,distributionMatches,distributionValue,distributionZone,positionalPassOutcome,zonePercentages,type DistributionFixture,type SpatialDistribution} from "./spatial-distributions";

test("dribble qualification excludes Unsuccessful instead of matching its successful substring",()=>{
 assert.equal(attackingEvent({category:"dribbles",outcome:"Unsuccessful"}),false);
 assert.equal(attackingEvent({category:"dribbles",outcome:"Successful"}),true);
 assert.equal(attackingEvent({category:"dribbles",outcome:"Won"}),true);
 assert.equal(positionalPassOutcome({passSuccessful:false,outcome:"Successful"}),false);
 assert.equal(positionalPassOutcome({outcome:"Incomplete"}),false);
});
test("provider attacking-relative coordinates are not flipped for home/away or second halves",()=>{
 assert.equal(distributionZone(90,90,"territory"),2);
 assert.equal(distributionZone(90,90,"channels"),0);
 assert.equal(distributionZone(90,90,"territory",true),0);
 assert.equal(distributionZone(90,90,"channels",true),2);
});
test("third/channel boundaries include the upper pitch edge without a fourth zone",()=>{
 assert.equal(distributionZone(0,0,"territory"),0);
 assert.equal(distributionZone(100,100,"territory"),2);
 assert.equal(distributionZone(100/3,50,"territory"),1);
 assert.equal(distributionZone(200/3,50,"territory"),2);
 assert.equal(distributionZone(0,100,"channels"),0);
 assert.equal(distributionZone(0,0,"channels"),2);
});
test("Event Explorer qualification is shared and excludes missing or invalid coordinates",()=>{
 const result=aggregatePositionalEvents([{category:"passing",passSuccessful:false,x:10,y:20},{category:"passing",passSuccessful:true,x:50,y:50},{category:"dribbles",outcome:"Unsuccessful",x:80,y:90},{category:"shots",x:90,y:90},{category:"touches",x:5,y:50},{category:"tackles",x:5,y:50},{category:"shots",x:NaN,y:50},{category:"shots",x:101,y:50}]);
 assert.equal(result.territorialTotal,5);assert.equal(result.attackingTotal,2);
 assert.deepEqual(result.thirds,[2,1,2]);assert.deepEqual(result.channels,[0,1,1]);
});
test("aggregate percentages pool event counts rather than averaging match shares",()=>{
 const pooled=zonePercentages(addZones([9,1,0],[0,90,0]));
 assert.deepEqual(pooled,[9,91,0]);assert.equal(pooled!.reduce((a,b)=>a+b,0),100);
 assert.equal(zonePercentages([0,0,0]),null);
});
test("venue and stage ordering use the selected club's actual completed matches",()=>{
 const fixture=(id:number,date:string,homeId:number,awayId:number,week:number):DistributionFixture=>({id,date,homeId,awayId,week,season:"2026-2027",home:"A",away:"B",finished:true,homeGoals:1,awayGoals:0});
 const matches=[fixture(1,"2026-08-01",44,37,1),fixture(2,"2026-10-01",37,44,2),fixture(3,"2026-08-15",44,37,3),{...fixture(4,"2026-08-20",44,37,4),finished:false}];
 assert.deepEqual(distributionMatches(matches,44,"all").slice(0,2).map(match=>match.id),[1,3]);
 assert.deepEqual(distributionMatches(matches,44,"away").map(match=>match.id),[2]);
 assert.deepEqual(distributionMatches(matches,44,"home",2,3).map(match=>match.id),[3]);
});
test("partial and unavailable historical coverage never become zero-valued statistics",()=>{
 const sample={status:"partial",counts:{territory:[9,1,0],channels:[1,2,3]}} as SpatialDistribution;
 assert.equal(distributionValue(sample,"territory",0),null);
 sample.status="complete";assert.equal(distributionValue(sample,"territory",0),90);assert.equal(distributionValue(sample,"territory",2),0);
 sample.counts.territory=[0,0,0];assert.equal(distributionValue(sample,"territory",0),null);
});
