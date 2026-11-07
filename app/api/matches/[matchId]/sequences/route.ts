import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";

type SequenceAction = { eventIdx:number|null; sequenceEvent:number|null; teamId:number|null; team:string|null; playerId:number|null; player:string|null; type:string|null; outcome:string|null; minute:number|null; second:number|null; period:string|null; x:number|null; y:number|null; endX:number|null; endY:number|null; passCompleted:boolean|null; shotGoal:boolean; ownGoal:boolean; shotResult:string|null };
type SequenceOrigin = { type:string|null; eventId:number|null; eventType:string|null; playerId:number|null; playerName:string|null; teamId:number|null; minute:number|null; second:number|null; x:number|null; y:number|null; evidence:string|null };
type Sequence = { id:string; teamId:number|null; team:string|null; actions:SequenceAction[]; ending:string|null; origin:SequenceOrigin|null };

const APP_EVENTS = "game_processed_events_app";
const APP_SHOTS = "game_shot_sequences_app";
const APP_PASSES = "game_pass_sequences_app";
const finite=(value:unknown)=>{const n=typeof value==="number"?value:Number(value);return Number.isFinite(n)?n:null;};
const bool=(value:unknown)=>value===true||value===1||value==="true"||value==="Successful";
const hasCategory=(row:any, category:string)=>Array.isArray(row.categories)&&row.categories.includes(category);
const isShot=(row:any)=>/shot|goal/i.test(String(row.type??row.event_type??""))||Boolean(row.shot_result)||Boolean(row.shot_goal??row.shot_is_goal)||hasCategory(row,"shot");
const action=(row:any):SequenceAction=>({eventIdx:finite(row.event_idx),sequenceEvent:finite(row.sequence_event),teamId:finite(row.team_id),team:typeof row.team==="string"?row.team:null,playerId:finite(row.player_id),player:typeof row.player==="string"?row.player:null,type:typeof (row.type??row.event_type)==="string"?(row.type??row.event_type):(hasCategory(row,"pass")?"Pass":hasCategory(row,"shot")?"Shot":null),outcome:typeof row.outcome_type==="string"?row.outcome_type:null,minute:finite(row.minute),second:finite(row.second),period:typeof row.period==="string"?row.period:null,x:finite(row.x),y:finite(row.y),endX:finite(row.end_x),endY:finite(row.end_y),passCompleted:row.pass_completed===null||row.pass_completed===undefined?null:bool(row.pass_completed),shotGoal:Boolean(row.shot_goal??row.shot_is_goal),ownGoal:Boolean(row.shot_own_goal),shotResult:typeof row.shot_result==="string"?row.shot_result:null});

function hydrate(row:any,source?:any){
  if(!source)return row;
  const merged={...source,...row};
  for(const key of ["team_id","team","player_id","player","type","event_type","outcome_type","minute","second","period","x","y","end_x","end_y","pass_completed","shot_goal","shot_is_goal","shot_result"]){
    if((row[key]===null||row[key]===undefined)&&source[key]!==null&&source[key]!==undefined)merged[key]=source[key];
  }
  if(!merged.categories&&source.categories)merged.categories=source.categories;
  return merged;
}

function normalizeShotSequence(sequence:Sequence):Sequence {
  const shot=[...sequence.actions].reverse().find(isShot);
  const owner=shot?.teamId??sequence.teamId;
  if(owner===null||owner===undefined)return sequence;
  const actions=sequence.actions.filter(item=>item.teamId===owner||item===shot).filter(item=>/pass/i.test(item.type??"")||item===shot||isShot(item)).map((item,index)=>({...item,sequenceEvent:index+1}));
  return {...sequence,teamId:owner,team:shot?.team??sequence.team,actions};
}

function normalizePassingSequence(sequence:Sequence):Sequence|null {
  if(sequence.actions.some(isShot)||/shot|goal/i.test(sequence.ending??""))return null;
  const owner=sequence.teamId;
  if(owner===null||owner===undefined)return sequence;
  const actions=sequence.actions.filter(item=>item.teamId===owner&&/pass/i.test(item.type??"")).map((item,index)=>({...item,sequenceEvent:index+1}));
  if(actions.filter(item=>/pass/i.test(item.type??"")&&item.passCompleted===true).length<2)return null;
  return {...sequence,actions};
}

function normalizeKickoffOrigin(sequence:Sequence|null):Sequence|null {
  if(!sequence)return sequence;
  const origin=sequence.origin;
  if(!origin||origin.type?.toLowerCase()!=="kickoff")return sequence;
  const eventType=origin.eventType?.toLowerCase()??"";
  const firstAction=sequence.actions.find(item=>item.minute!==null)||null;
  const startIsAdjacent=eventType!=="start"||firstAction===null||firstAction.minute===null||origin.minute===null||firstAction.minute<=origin.minute+2;
  const originIsRecordedRestart=new Set(["start","kickoff","kickofftaken"]).has(eventType)&&origin.teamId===sequence.teamId&&startIsAdjacent;
  return {...sequence,origin:{...origin,teamId:sequence.teamId,playerId:originIsRecordedRestart?origin.playerId:null,playerName:originIsRecordedRestart?origin.playerName:null,minute:originIsRecordedRestart?origin.minute:firstAction?.minute??null,second:originIsRecordedRestart?origin.second:firstAction?.second??null}};
}

function includeRecordedOriginPass(sequence:Sequence,sourceByEvent:Map<string,any>):Sequence {
  const origin=sequence.origin;
  if(!origin||origin.eventId===null||!/(corner|free kick|throw-in|goal kick)/i.test(origin.type??"")||sequence.actions.some(item=>item.eventIdx===origin.eventId))return sequence;
  const source=sourceByEvent.get(String(origin.eventId));
  if(!source||source.team_id!==sequence.teamId||!(hasCategory(source,"pass")||/pass/i.test(String(source.type??source.event_type??""))))return sequence;
  const actions=[...sequence.actions,action(source)].sort((a,b)=>(a.eventIdx??9999)-(b.eventIdx??9999)).map((item,index)=>({...item,sequenceEvent:index+1}));
  return {...sequence,actions};
}

function normalizeOriginIdentity(sequence:Sequence,sourceByEvent:Map<string,any>):Sequence {
  const origin=sequence.origin;
  if(!origin||origin.playerId===null||origin.type?.toLowerCase()==="opponent turnover")return sequence;
  const teams=new Set([...sourceByEvent.values()].filter(event=>event.player_id===origin.playerId).map(event=>event.team_id).filter((team):team is number=>typeof team==="number"));
  const source=origin.eventId===null?null:sourceByEvent.get(String(origin.eventId));
  if((source&&source.team_id!==sequence.teamId)||(teams.size>0&&(sequence.teamId===null||!teams.has(sequence.teamId))))return {...sequence,origin:{...origin,teamId:sequence.teamId,playerId:null,playerName:null}};
  return sequence;
}

async function read(db:any,collection:string,gameId:number):Promise<Sequence[]> {
  try {
    const [documents,sourceRows]=await Promise.all([
      db.collection(collection).find({game_id:gameId}).sort({sequence_id:1,sequence_key:1}).toArray(),
      db.collection(APP_EVENTS).find({game_id:gameId},{projection:{_id:0,event_idx:1,team_id:1,team:1,player_id:1,player:1,type:1,event_type:1,categories:1}}).toArray()
    ]);
    const byEvent=new Map<string,any>(sourceRows.map((event:any)=>[String(event.event_idx),event] as [string,any]));
    const sequences:Sequence[]=documents.map((document:any)=>{
      const actions=(Array.isArray(document.actions)?document.actions:[]).map((raw:any)=>action(hydrate(raw,byEvent.get(String(raw.event_idx)))));
      const origin:SequenceOrigin|null=typeof document.origin_type==="string"?{type:document.origin_type,eventId:finite(document.origin_event_id),eventType:typeof document.origin_event_type==="string"?document.origin_event_type:null,playerId:finite(document.origin_player_id),playerName:typeof document.origin_player_name==="string"?document.origin_player_name:null,teamId:finite(document.origin_team_id),minute:finite(document.origin_minute),second:finite(document.origin_second),x:finite(document.origin_x),y:finite(document.origin_y),evidence:typeof document.origin_evidence==="string"?document.origin_evidence:null}:null;
      return {id:String(document.sequence_key??document._id??`${gameId}_${document.sequence_id??""}`),teamId:finite(document.sequence_team_id??document.team_id),team:typeof (document.sequence_team??document.team)==="string"?(document.sequence_team??document.team):null,actions:actions.sort((a:SequenceAction,b:SequenceAction)=>(a.sequenceEvent??9999)-(b.sequenceEvent??9999)||(a.eventIdx??9999)-(b.eventIdx??9999)),ending:typeof document.sequence_ending==="string"?document.sequence_ending:null,origin};
    });
    return sequences.map(sequence=>normalizeKickoffOrigin(collection===APP_SHOTS?normalizeShotSequence(sequence):normalizePassingSequence(sequence))).filter((sequence):sequence is Sequence=>sequence!==null).map(sequence=>includeRecordedOriginPass(normalizeOriginIdentity(sequence,byEvent),byEvent));
  } catch {
    return [];
  }
}

export async function GET(_request:Request,{params}:{params:Promise<{matchId:string}>}) {
  const started=performance.now();
  const gameId=Number((await params).matchId);
  if(!Number.isInteger(gameId))return NextResponse.json({error:"Invalid match id."},{status:400});
  try {
    const db=await database();
    const [shotSequences,passingSequences]=await Promise.all([read(db,APP_SHOTS,gameId),read(db,APP_PASSES,gameId)]);
    return NextResponse.json({shotSequences,passingSequences},{headers:{"Cache-Control":"no-store","Server-Timing":`sequences;dur=${(performance.now()-started).toFixed(1)}`} });
  } catch {
    return NextResponse.json({shotSequences:[],passingSequences:[],error:"Sequence data is unavailable."},{status:503});
  }
}
