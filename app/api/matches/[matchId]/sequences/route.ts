import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";

type SequenceAction = { eventIdx:number|null; sequenceEvent:number|null; teamId:number|null; team:string|null; playerId:number|null; player:string|null; type:string|null; outcome:string|null; minute:number|null; second:number|null; period:string|null; x:number|null; y:number|null; endX:number|null; endY:number|null; passCompleted:boolean|null; shotGoal:boolean; ownGoal:boolean; shotResult:string|null };
type SequenceOrigin = { type:string|null; eventId:number|null; eventType:string|null; playerId:number|null; playerName:string|null; teamId:number|null; minute:number|null; second:number|null; x:number|null; y:number|null; evidence:string|null };
type Sequence = { id:string; teamId:number|null; team:string|null; actions:SequenceAction[]; ending:string|null; origin:SequenceOrigin|null };
const finite=(value:unknown)=>{const n=typeof value==="number"?value:Number(value);return Number.isFinite(n)?n:null;};
const bool=(value:unknown)=>value===true||value===1||value==="true"||value==="Successful";
const action=(row:any):SequenceAction=>({eventIdx:finite(row.event_idx),sequenceEvent:finite(row.sequence_event),teamId:finite(row.team_id),team:typeof row.team==="string"?row.team:null,playerId:finite(row.player_id),player:typeof row.player==="string"?row.player:null,type:typeof (row.type??row.event_type)==="string"?(row.type??row.event_type):(bool(row.pass_event)?"Pass":bool(row.shot_event)?"Shot":null),outcome:typeof row.outcome_type==="string"?row.outcome_type:null,minute:finite(row.minute),second:finite(row.second),period:typeof row.period==="string"?row.period:null,x:finite(row.x),y:finite(row.y),endX:finite(row.end_x),endY:finite(row.end_y),passCompleted:row.pass_completed===null||row.pass_completed===undefined?null:bool(row.pass_completed),shotGoal:Boolean(row.shot_goal??row.shot_is_goal),ownGoal:Boolean(row.shot_own_goal),shotResult:typeof row.shot_result==="string"?row.shot_result:null});
const eventProjection={_id:0,event_idx:1,team_id:1,team:1,player_id:1,player:1,type:1,event_type:1,outcome_type:1,minute:1,second:1,period:1,x:1,y:1,end_x:1,end_y:1,pass_event:1,shot_event:1,pass_completed:1,shot_goal:1,shot_is_goal:1,shot_own_goal:1,shot_result:1};
function hydrate(row:any,source?:any){
  if(!source)return row;
  const merged={...source,...row};
  for(const key of ['team_id','team','player_id','player','type','event_type','outcome_type','minute','second','period','x','y','end_x','end_y','pass_event','shot_event','pass_completed','shot_goal','shot_is_goal','shot_result']){
    if((row[key]===null||row[key]===undefined)&&source[key]!==null&&source[key]!==undefined)merged[key]=source[key];
  }
  return merged;
}
function normalizeShotSequence(sequence:Sequence):Sequence|null {
  const shot=[...sequence.actions].reverse().find(item=>/shot|goal/i.test(item.type??'')||Boolean(item.shotResult)||item.shotGoal||item.ownGoal);
  const owner=shot?.teamId??sequence.teamId;
  if(owner===null||owner===undefined)return sequence;
  // A shot buildup is displayed as the connected passing chain plus its
  // terminal shot.  Carries/take-ons and other same-team context can keep a
  // possession alive while it is being built, but they are not pass links and
  // must not create misleading movement paths in the sequence view.
  const actions=sequence.actions
    .filter(item=>item.teamId===owner || item===shot)
    .filter(item=>/pass/i.test(item.type??'') || item===shot || /shot|goal/i.test(item.type??'') || Boolean(item.shotResult) || item.shotGoal || item.ownGoal)
    .map((item,index)=>({...item,sequenceEvent:index+1}));
  return {...sequence,teamId:owner,team:shot?.team??sequence.team,actions};
}
function normalizePassingSequence(sequence:Sequence):Sequence|null {
  if(/shot|goal/i.test(sequence.ending??"")||sequence.actions.some(item=>/shot|goal/i.test(item.type??"")||Boolean(item.shotResult)||item.shotGoal||item.ownGoal))return null;
  const owner=sequence.teamId;
  if(owner===null||owner===undefined)return sequence;
  const actions=sequence.actions.filter(item=>item.teamId===owner&&/pass/i.test(item.type??'')).map((item,index)=>({...item,sequenceEvent:index+1}));
  if(actions.filter(item=>/pass/i.test(item.type??"")&&item.passCompleted===true).length<2)return null;
  return {...sequence,teamId:owner,actions};
}
async function read(db:any,collection:string,gameId:number):Promise<Sequence[]> { try { const [rows,sourceRows]=await Promise.all([db.collection(collection).find({game_id:gameId},{projection:{_id:0,sequence_id:1,sequence_key:1,sequence_event:1,event_idx:1,team_id:1,team:1,player_id:1,player:1,type:1,event_type:1,outcome_type:1,minute:1,second:1,period:1,x:1,y:1,end_x:1,end_y:1,pass_event:1,shot_event:1,pass_completed:1,shot_goal:1,shot_is_goal:1,shot_own_goal:1,shot_result:1,sequence_team_id:1,sequence_team:1,sequence_ending:1,origin_type:1,origin_event_id:1,origin_event_type:1,origin_player_id:1,origin_player_name:1,origin_team_id:1,origin_minute:1,origin_second:1,origin_x:1,origin_y:1,origin_evidence:1}}).sort({sequence_id:1,sequence_event:1,event_idx:1}).toArray(),db.collection("game_processed_events").find({game_id:gameId},{projection:eventProjection}).toArray()]); const byEvent=new Map(sourceRows.map((event:any)=>[String(event.event_idx),event])); const groups=new Map<string,Sequence>(); for(const raw of rows){const row=hydrate(raw,raw.event_idx===null||raw.event_idx===undefined?undefined:byEvent.get(String(raw.event_idx)));const key=String(row.sequence_key??`${gameId}_${row.sequence_id??row.event_idx}`);const current:Sequence=groups.get(key)??{id:key,teamId:finite(row.sequence_team_id??row.team_id),team:typeof (row.sequence_team??row.team)==="string"?(row.sequence_team??row.team):null,actions:[],ending:typeof row.sequence_ending==="string"?row.sequence_ending:null,origin:null};current.actions.push(action(row));if(!current.ending&&typeof row.sequence_ending==="string")current.ending=row.sequence_ending;if(!current.origin&&typeof row.origin_type==="string")current.origin={type:row.origin_type,eventId:finite(row.origin_event_id),eventType:typeof row.origin_event_type==="string"?row.origin_event_type:null,playerId:finite(row.origin_player_id),playerName:typeof row.origin_player_name==="string"?row.origin_player_name:null,teamId:finite(row.origin_team_id),minute:finite(row.origin_minute),second:finite(row.origin_second),x:finite(row.origin_x),y:finite(row.origin_y),evidence:typeof row.origin_evidence==="string"?row.origin_evidence:null};groups.set(key,current);} return [...groups.values()].map(sequence=>({...sequence,actions:sequence.actions.sort((a,b)=>(a.sequenceEvent??9999)-(b.sequenceEvent??9999)||(a.eventIdx??9999)-(b.eventIdx??9999))})).map(sequence=>collection==="game_shot_sequences"?normalizeShotSequence(sequence):normalizePassingSequence(sequence)).filter((sequence):sequence is Sequence=>sequence!==null); } catch { return []; } }
export async function GET(_request:Request,{params}:{params:Promise<{matchId:string}>}) { const started=performance.now(); const gameId=Number((await params).matchId); if(!Number.isInteger(gameId))return NextResponse.json({error:"Invalid match id."},{status:400}); try { const db=await database(); const [shotSequences,passingSequences]=await Promise.all([read(db,"game_shot_sequences",gameId),read(db,"game_pass_sequences",gameId)]); return NextResponse.json({shotSequences,passingSequences},{headers:{"Cache-Control":"no-store","Server-Timing":`sequences;dur=${(performance.now()-started).toFixed(1)}`}}); } catch { return NextResponse.json({shotSequences:[],passingSequences:[],error:"Sequence data is unavailable."},{status:503}); } }




