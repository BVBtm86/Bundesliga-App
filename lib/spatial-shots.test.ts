import assert from "node:assert/strict";
import test from "node:test";
import { spatialShot } from "./spatial-shots";

const event={game_id:1,event_idx:4,x:86,y:44,goal_mouth_y:48,goal_mouth_z:0};
const qualifier=(displayName:string,value?:string)=>({type:{displayName},value});
const mouth=[qualifier("GoalMouthY","48"),qualifier("GoalMouthZ","0")];

test("goal-plane coordinates require matching raw qualifiers and retain recorded zero",()=>{
  const shot=spatialShot(event,[...mouth,qualifier("LeftFoot"),qualifier("DirectFreekick")]);
  assert.deepEqual(shot.goal,{y:48,z:0});
  assert.deepEqual(shot.origin,{x:56,y:14});
  assert.equal(shot.bodyPart,"Left foot");
  assert.equal(shot.situation,"Direct free kick");
  assert.equal(spatialShot(event,[]).goal,null);
  assert.equal(spatialShot({...event,goal_mouth_z:null},mouth).goal,null);
  assert.equal(spatialShot({...event,goal_mouth_z:7},mouth).goal,null);
});

test("blocks use validated pitch locations and own goals have no opponent goal destination",()=>{
  const block=spatialShot({...event,shot_blocked:true,type:"SavedShot",blocked_x:92,blocked_y:43},[
    ...mouth,qualifier("BlockedX","92"),qualifier("BlockedY","43")
  ]);
  assert.deepEqual(block.block,{x:57,y:8});
  assert.equal(block.outcome,"blocked");
  assert.equal(block.goal,null);
  const own=spatialShot({...event,x:5,type:"Goal",shot_own_goal:true},mouth);
  assert.equal(own.outcome,"own goal");
  assert.equal(own.origin?.y,95);
  assert.equal(own.goal,null);
});

test("woodwork remains distinct from missed shots",()=>{
  assert.equal(spatialShot({...event,type:"ShotOnPost",shot_result:"Off Target"},mouth).outcome,"woodwork");
  assert.equal(spatialShot({...event,type:"MissedShots",shot_result:"Off Target"},mouth).outcome,"off target");
});
