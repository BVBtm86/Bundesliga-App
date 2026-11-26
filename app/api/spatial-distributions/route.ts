import {NextResponse} from "next/server";
import {database} from "@/lib/mongo";
import {spatialDistributionPipeline} from "@/lib/spatial-distribution-query";
import {addZones,distributionMatches,SPATIAL_METHODOLOGY,type DistributionBasis,type DistributionSeasonMeta,type SpatialDistribution,type ZoneCounts} from "@/lib/spatial-distributions";
export const dynamic="force-dynamic";
const metadataCache=new Map<string,{until:number;value:DistributionSeasonMeta}>();
type CountsRow={_id:{game:number;team:number};events:number}&Record<string,any>;
const eventCache=new Map<string,{until:number;rows:CountsRow[]}>();
const inFlight=new Map<string,Promise<void>>();
async function seasonMeta(season:string):Promise<DistributionSeasonMeta>{
 const hit=metadataCache.get(season);if(hit&&hit.until>Date.now())return hit.value;
 const db=await database();
 const [rows,teams]=await Promise.all([db.collection("game_schedule").find({season,competition_name:"Bundesliga",competition_country:"Germany"},{projection:{_id:0,game_id:1,week:1,game_date:1,home_team_id:1,away_team_id:1,home_team_name:1,away_team_name:1,home_goals:1,away_goals:1,game_status:1}}).toArray(),db.collection("available_teams").find({},{projection:{_id:0,ws_team_id:1,team_logo:1}}).toArray()]);
 const logos=new Map(teams.map(row=>[row.ws_team_id,row.team_logo]));
 const fixtures=[...new Map(rows.filter(row=>Number.isSafeInteger(row.game_id)).map(row=>[row.game_id,{id:row.game_id,season,week:row.week,date:row.game_date instanceof Date?row.game_date.toISOString():String(row.game_date??""),homeId:row.home_team_id,awayId:row.away_team_id,home:row.home_team_name,away:row.away_team_name,finished:row.game_status==="finished",cancelled:row.game_status==="cancelled",homeGoals:Number.isInteger(row.home_goals)&&row.home_goals>=0?row.home_goals:null,awayGoals:Number.isInteger(row.away_goals)&&row.away_goals>=0?row.away_goals:null}])).values()];
 const participants=new Map<number,{id:number;name:string;logo?:string;played:number}>();
 for(const match of fixtures)for(const home of [true,false]){
  const id=home?match.homeId:match.awayId;if(!Number.isSafeInteger(id))continue;
  const entry=participants.get(id)??{id,name:home?match.home:match.away,logo:logos.get(id),played:0};
  if(match.finished&&match.homeGoals!==null&&match.awayGoals!==null)entry.played++;
  participants.set(id,entry);
 }
 const complete=fixtures.filter(match=>match.finished&&match.homeGoals!==null&&match.awayGoals!==null).length>=Math.max(306,fixtures.filter(match=>!match.cancelled).length);
 const value={season,fixtures,complete,teams:[...participants.values()].sort((a,b)=>a.name.localeCompare(b.name))};
 if(metadataCache.size>40)metadataCache.delete(metadataCache.keys().next().value!);metadataCache.set(season,{until:Date.now()+120000,value});return value;
}
async function matchCounts(ids:number[],period:"ft"|"fh"|"sh"){
 const missing=[...new Set(ids)].filter(id=>!eventCache.get(`${period}:${id}`)||eventCache.get(`${period}:${id}`)!.until<Date.now()).sort((a,b)=>a-b);
 for(let offset=0;offset<missing.length;offset+=80){
  const batch=missing.slice(offset,offset+80),key=`${period}:${batch.join(",")}`;
  let pending=inFlight.get(key);
  if(!pending){pending=(async()=>{
   const db=await database();const rows=await db.collection("game_processed_events_app").aggregate<CountsRow>(spatialDistributionPipeline(batch,period),{maxTimeMS:60000,allowDiskUse:true}).toArray();
   for(const id of batch){if(eventCache.size>=7000)eventCache.delete(eventCache.keys().next().value!);eventCache.set(`${period}:${id}`,{until:Date.now()+300000,rows:rows.filter(row=>row._id.game===id)});}
  })();inFlight.set(key,pending);}
  try{await pending;}finally{inFlight.delete(key);}
 }
}
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 const seasons=[...new Set((p.get("seasons")??"").split(","))].sort();
 const kind=p.get("kind")??"history",basis=(p.get("basis")??"stage") as DistributionBasis;
 const venue=(p.get("venue")??"all") as "all"|"home"|"away",period=(p.get("period")??"ft") as "ft"|"fh"|"sh";
 const teams=(p.get("teams")??"").split(",").map(Number),pair=(p.get("pair")??"").split(",");
 const metadata=p.get("metadata")==="1";
 const from=Number(p.get("from")??1),to=Number(p.get("to")??34),against=p.get("side")==="against",league=p.get("league")==="1";
 if(!seasons.length||seasons.length>30||seasons.some(season=>!/^\d{4}-\d{4}$/.test(season)||season<"2009-2010"||Number(season.slice(5))!==Number(season.slice(0,4))+1)||!["history","teams"].includes(kind)||!["full","stage","perMatch"].includes(basis)||!["all","home","away"].includes(venue)||!["for","against"].includes(p.get("side")??"for")||!["ft","fh","sh"].includes(period)||![from,to].every(Number.isInteger)||from<1||to>34||to<from||basis==="full"&&(from!==1||to!==34)||(!metadata&&(teams.length<1||teams.length>2||teams.some(team=>!Number.isSafeInteger(team)||team<1)||kind==="teams"&&(teams.length!==2||teams[0]===teams[1])||kind==="history"&&teams.length!==1||pair.length!==2||pair.some(season=>!seasons.includes(season)))))return NextResponse.json({error:"Choose valid spatial distribution filters."},{status:400});
 try{
  const metas=new Map<string,DistributionSeasonMeta>();for(const season of seasons)metas.set(season,await seasonMeta(season));
  if(metadata)return NextResponse.json({seasons:seasons.map(season=>{const meta=metas.get(season)!;return {season,complete:meta.complete,teams:meta.teams};})},{headers:{"Cache-Control":"private, max-age=120"}});
  const pairSamples=pair.map((season,index)=>({season,team:kind==="history"?teams[0]:teams[index]??teams[0]}));
  const stage=basis==="stage"?Math.min(...pairSamples.map(sample=>distributionMatches(metas.get(sample.season)!.fixtures,sample.team,venue,from,to).length)):null;
  const requested=kind==="history"?seasons.map(season=>({season,team:teams[0]})):pairSamples;
  const samples:SpatialDistribution[]=[];
  for(const item of requested){
   const meta=metas.get(item.season)!,entry=meta.teams.find(team=>team.id===item.team);
   const available=distributionMatches(meta.fixtures,item.team,venue,from,to);
   const included=basis==="stage"?available.slice(0,stage??0):available;
   const empty=():SpatialDistribution=>({...item,name:entry?.name??"Team unavailable",logo:entry?.logo,ongoing:!meta.complete,status:!entry?"absent":basis==="full"&&!meta.complete?"ongoing":basis==="stage"&&(!stage||available.length<stage)?"insufficient":"unavailable",available:available.length,included:0,covered:0,counts:{territory:[0,0,0],channels:[0,0,0]}});
   if(!entry||basis==="full"&&!meta.complete||basis==="stage"&&(!stage||available.length<stage)||!included.length){samples.push(empty());continue;}
   const leagueSamples=league?meta.teams.flatMap(club=>{const matches=distributionMatches(meta.fixtures,club.id,venue,from,to);return basis==="stage"&&matches.length<(stage??0)?[]:[{team:club.id,matches:basis==="stage"?matches.slice(0,stage??0):matches}];}):[];
   await matchCounts([...included,...leagueSamples.flatMap(row=>row.matches)].map(match=>match.id),period);
   const aggregate=(team:number,matches:typeof included)=>{
    let covered=0,recorded=0;let territory:ZoneCounts=[0,0,0],channels:ZoneCounts=[0,0,0];
    for(const match of matches){const source=against?(match.homeId===team?match.awayId:match.homeId):team;const row=eventCache.get(`${period}:${match.id}`)?.rows.find(row=>row._id.team===source);if(!row?.events)continue;recorded++;const required=period==="fh"?["FirstHalf"]:period==="sh"?["SecondHalf"]:["FirstHalf","SecondHalf"];if(required.every(value=>row.periods?.includes(value)))covered++;
     const counts=(name:string)=>[0,1,2].map(index=>row[`${name}${index}`]??0) as ZoneCounts;
     territory=addZones(territory,counts(against?"againstTerritory":"territory"));channels=addZones(channels,counts(against?"againstChannels":"channels"));
    }
    return {covered,recorded,territory,channels};
   };
   const counts=aggregate(item.team,included);const total=counts.territory.reduce((a,b)=>a+b,0);
   const sample:SpatialDistribution={...item,name:entry.name,logo:entry.logo,ongoing:!meta.complete,available:available.length,included:included.length,covered:counts.covered,status:!counts.recorded?"unavailable":counts.covered<included.length?"partial":!total?"no-events":"complete",counts:{territory:counts.territory,channels:counts.channels}};
   if(league){let territory:ZoneCounts=[0,0,0],channels:ZoneCounts=[0,0,0],clubs=0,matches=0;for(const row of leagueSamples){if(!row.matches.length)continue;const value=aggregate(row.team,row.matches);if(value.covered!==row.matches.length)continue;clubs++;matches+=row.matches.length;territory=addZones(territory,value.territory);channels=addZones(channels,value.channels);}sample.league={counts:{territory,channels},clubs,matches,events:territory.reduce((a,b)=>a+b,0)};}
   samples.push(sample);
  }
  return NextResponse.json({samples,stage,basis,methodology:SPATIAL_METHODOLOGY,perspective:against?"Against: opponents’ actions rotated into the selected club’s attacking-right perspective. Defensive third is the selected club’s own goal; left/right are from its forward-facing perspective.":"For: provider attacking-relative coordinates, with each selected club attacking left to right. No home/away or half flip is applied."},{headers:{"Cache-Control":"private, max-age=60"}});
 }catch(error){console.error("Spatial distributions unavailable",error instanceof Error?error.name:"Unknown error");return NextResponse.json({error:"Spatial distribution data is temporarily unavailable."},{status:503});}
}
