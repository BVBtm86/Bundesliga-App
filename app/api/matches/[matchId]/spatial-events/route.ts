import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";

type NormalizedEvent={id:number;teamId:number;team?:string;playerId?:number;recipientId?:number;player?:string;type?:string;category:string;touchEvent?:boolean;outcome?:string;minute?:number;second?:number;period?:number|string;x?:number;y?:number;endX?:number;endY?:number;result?:string;passSuccessful?:boolean;goal:boolean;onTarget:boolean;blocked:boolean};
const cacheKey=Symbol.for("bundesliga.spatialEventsCache.v8");
const globalCache=globalThis as typeof globalThis & {[cacheKey]?:Map<number,{at:number;events:NormalizedEvent[]}>};
const categories:Record<string,string>={touches:"touches",shots:"shots",passing:"passing",dribbles:"dribbles",tackles:"tackles",interceptions:"interceptions",recoveries:"recoveries",clearances:"clearances",aerial:"aerial",offsides:"offside",errors:"error",saves:"save",claims:"claim",punches:"punch",fouls:"fouls",losses:"losses"};
const finite=(value:unknown)=>{const number=typeof value==='number'?value:Number(value);return Number.isFinite(number)?number:undefined};
const booleanValue=(value:unknown)=>{if(value===true||value===1)return true;if(value===false||value===0)return false;if(typeof value==='string'){const normalized=value.trim().toLowerCase();if(normalized==='true'||normalized==='1'||normalized==='successful'||normalized==='complete'||normalized==='completed')return true;if(normalized==='false'||normalized==='0'||normalized==='unsuccessful'||normalized==='incomplete'||normalized==='failed')return false;}return undefined};
const classify=(row:any)=>{const values=Array.isArray(row.categories)?row.categories:[];if(values.includes("pass"))return "passing";if(values.includes("shot"))return "shots";if(values.includes("dribble"))return "dribbles";if(values.includes("tackle"))return "tackles";if(values.includes("interception"))return "interceptions";if(values.includes("clearance"))return "clearances";if(values.includes("offside"))return "offside";if(values.includes("aerial"))return "aerial";if(values.includes("error"))return "error";if(values.includes("save"))return "save";if(values.includes("claim"))return "claim";if(values.includes("punch"))return "punch";if(values.includes("recovery"))return "recoveries";if(values.includes("foul"))return "fouls";if(values.includes("loss"))return "losses";if(values.includes("touch"))return "touches";return "other"};
const normalize=(row:any):NormalizedEvent=>({id:row.event_idx,teamId:row.team_id,team:row.team,playerId:row.player_id,recipientId:row.recipient_id??row.pass_recipient_id??row.related_player_id,player:row.player,type:row.type??row.event_type,category:classify(row),touchEvent:Array.isArray(row.categories)&&row.categories.includes("touch"),outcome:row.aerial_result??row.outcome_type,minute:finite(row.minute),second:finite(row.second),period:row.period,x:finite(row.x),y:finite(row.y),endX:finite(row.end_x),endY:finite(row.end_y),result:row.shot_result,passSuccessful:booleanValue(row.pass_completed)??booleanValue(row.pass_successful),goal:Boolean(row.shot_goal),onTarget:Boolean(row.shot_on_target),blocked:Boolean(row.shot_blocked)});

async function allEvents(gameId:number,profile?:Record<string,number>){
  const cache=globalCache[cacheKey]??(globalCache[cacheKey]=new Map());
  const hit=cache.get(gameId);
  if(hit&&Date.now()-hit.at<300000){if(profile)profile.cache=0;return hit.events;}
  const dbStarted=performance.now();
  const db=await database();
  if(profile)profile.database=performance.now()-dbStarted;
  const queryStarted=performance.now();
  const rows=await db.collection("game_processed_events_app").find({game_id:gameId},{projection:{_id:0,event_idx:1,team_id:1,team:1,player_id:1,recipient_id:1,pass_recipient_id:1,related_player_id:1,player:1,type:1,event_type:1,outcome_type:1,minute:1,second:1,period:1,x:1,y:1,end_x:1,end_y:1,pass_completed:1,pass_successful:1,shot_result:1,shot_goal:1,shot_on_target:1,shot_blocked:1,categories:1}}).sort({event_idx:1}).toArray();
  if(profile)profile.query=performance.now()-queryStarted;
  const normalizeStarted=performance.now();
  const events=rows.map(normalize);
  cache.set(gameId,{at:Date.now(),events});
  if(profile)profile.normalize=performance.now()-normalizeStarted;
  return events;
}

export async function GET(request:Request,{params}:{params:Promise<{matchId:string}>}){
  const requestStarted=performance.now();
  const gameId=Number((await params).matchId);
  if(!Number.isInteger(gameId))return NextResponse.json({error:"Invalid match id."},{status:400});
  const url=new URL(request.url);
  const category=url.searchParams.get("category")??"all";
  const from=Math.max(0,Number(url.searchParams.get("from")??0));
  const to=Math.max(from,Number(url.searchParams.get("to")??150));
  try{
    const profile:Record<string,number>|undefined=process.env.SPATIAL_EVENTS_PROFILE==="1"?{}:undefined;
    const events=await allEvents(gameId,profile);
    const filterStarted=performance.now();
    const filtered:NormalizedEvent[]=events.filter((event:NormalizedEvent)=>(category==="all"||event.category===categories[category])&&(event.minute??0)>=from&&(event.minute??0)<=to);
    const maxMinute=events.reduce((max:number,event:NormalizedEvent)=>typeof event.minute==="number"?Math.max(max,event.minute):max,90);
    const body={events:filtered,category,from,to,maxMinute};
    if(profile){profile.filter=performance.now()-filterStarted;const serializationStarted=performance.now();const bytes=JSON.stringify(body).length;profile.serialization=performance.now()-serializationStarted;profile.total=performance.now()-requestStarted;console.info("[spatial-events]",JSON.stringify({gameId,category,from,to,rows:events.length,returned:filtered.length,bytes,timingMs:profile}));}
    return NextResponse.json(body,{headers:{"Cache-Control":"private, max-age=300"}});
  }catch(error){
    console.error("Spatial match events unavailable:",error instanceof Error?error.name:"Unknown error");
    return NextResponse.json({error:"Spatial events are unavailable."},{status:503});
  }
}
