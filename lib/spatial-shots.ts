import { portraitEventPoint, type SpatialPoint } from "./spatial-density";

export type SpatialShotOutcome="goal"|"on target"|"off target"|"blocked"|"woodwork"|"own goal"|"unclassified";
export type SpatialShot={
  key:string;matchId:number;player?:string;minute?:number;outcome:SpatialShotOutcome;
  origin:SpatialPoint|null; goal:{y:number;z:number}|null; block:SpatialPoint|null;
  bodyPart?:string;situation?:string;
};
export type ShotQualifiers={type?:{displayName?:string};value?:unknown}[];
type ShotRecord={
  game_id:number;event_idx:number;player?:string;minute?:number;type?:string;x?:number;y?:number;
  goal_mouth_y?:number|null;goal_mouth_z?:number|null;blocked_x?:number|null;blocked_y?:number|null;
  shot_own_goal?:boolean;shot_woodwork?:boolean;shot_goal?:boolean;shot_blocked?:boolean;shot_on_target?:boolean;shot_result?:string;
};

export function shotOutcome(event:ShotRecord):SpatialShotOutcome{
  const result=event.shot_result?.toLowerCase();
  if(event.shot_own_goal||result==="own goal")return "own goal";
  if(event.shot_goal||result==="goal"||event.type==="Goal")return "goal";
  if(event.shot_blocked||result==="blocked")return "blocked";
  if(event.shot_woodwork||event.type==="ShotOnPost"||result==="woodwork")return "woodwork";
  if(event.shot_on_target||result==="on target"||event.type==="SavedShot")return "on target";
  if(result==="off target"||event.type==="MissedShots")return "off target";
  return "unclassified";
}

const bodyParts=[["LeftFoot","Left foot"],["RightFoot","Right foot"],["Head","Head"],["OtherBodyPart","Other body part"]] as const;
const situations=[
  ["Penalty","Penalty"],["DirectFreekick","Direct free kick"],["FromCorner","From corner"],
  ["ThrowinSetPiece","From throw-in"],["FastBreak","Fast break"],["SetPiece","Set piece"],["RegularPlay","Open play"]
] as const;

export function spatialShot(event:ShotRecord,qualifiers:ShotQualifiers):SpatialShot{
  const tags=new Map(qualifiers.flatMap(q=>q.type?.displayName?[[q.type.displayName,q.value] as const]:[]));
  const validated=(key:string,value:unknown):value is number=>{
    const raw=tags.get(key);
    return (typeof raw==="number"||(typeof raw==="string"&&raw.trim()!==""))&&typeof value==="number"&&
      value>=0&&value<=100&&Number(raw)===value;
  };
  const outcome=shotOutcome(event);
  const {goal_mouth_y:y,goal_mouth_z:z,blocked_x:bx,blocked_y:by}=event;
  // Blocked goal-mouth values are often coded placeholders. Own goals lack a validated own-goal destination frame.
  const goal=outcome!=="blocked"&&outcome!=="own goal"&&validated("GoalMouthY",y)&&validated("GoalMouthZ",z)?{y,z}:null;
  const block=outcome==="blocked"&&validated("BlockedX",bx)&&validated("BlockedY",by)?portraitEventPoint(bx,by):null;
  return {key:`${event.game_id}:${event.event_idx}`,matchId:event.game_id,player:event.player,minute:event.minute,
    outcome,origin:portraitEventPoint(event.x,event.y),goal,block,
    bodyPart:bodyParts.find(([key])=>tags.has(key))?.[1],situation:situations.find(([key])=>tags.has(key))?.[1]};
}
