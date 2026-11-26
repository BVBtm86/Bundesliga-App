import { buildPassingNetwork, type NetworkEvent } from "./passing-network";
import { portraitEventPoint, type SpatialMarker } from "./spatial-density";

export type LineupRow = {
  game_id:number; player_id:number; player_name?:string; jersey_number?:number;
  starting_lineup?:boolean|number; starting_position?:string; minutes_played?:number;
};
export type FormationRow = {game_id:number; formation:string; positions:string};
export type FormationTemplate = {formation_key:string; positions:{position?:string;role?:string;x:number;y:number}[]};
export type LineupEvent = NetworkEvent & {type?:string};
export type LineupSelection = "common"|"minutes";
export type FormationUsage = {formation:string;count:number};
export type SpatialLineup = {
  formation:string|null; formationCount:number; formationMatches:number; scopedMatches:number; lineupCount:number|null;
  completeLineupMatches:number; distribution:FormationUsage[]; missingRoles:string[]; selectedPlayers:number;
};

const starter=(row:LineupRow)=>row.starting_lineup===true||row.starting_lineup===1;
const role=(row:LineupRow)=>row.starting_position?.trim().toUpperCase()??"";
const minute=(event:LineupEvent)=>typeof event.minute==="number"?event.minute+(event.second??0)/60:null;
const inPeriod=(event:LineupEvent,period:string)=>period==="ft"||event.period===(period==="fh"?"FirstHalf":"SecondHalf");

export function recordedFormations(rows:FormationRow[]){
  const formations=[...new Map(rows.filter(item=>typeof item.formation==="string"&&item.formation.trim()).map(item=>[item.game_id,item])).values()];
  const frequencies=new Map<string,number>();
  for(const row of formations)frequencies.set(row.formation,(frequencies.get(row.formation)??0)+1);
  const distribution=[...frequencies].map(([formation,count])=>({formation,count}))
    .sort((a,b)=>b.count-a.count||a.formation.localeCompare(b.formation));
  return {formations,frequencies,distribution};
}

export function aggregateSpatialLineup(input:{
  team:number; period:string; selection?:LineupSelection; formations:FormationRow[]; templates:FormationTemplate[];
  lineups:LineupRow[]; events:Map<number,LineupEvent[]>; mode:string;
}) {
  const {team,period,lineups,events,mode}=input;
  const byMinutes=mode!=="lineup"&&input.selection==="minutes";
  const byMatch=new Map<number,LineupRow[]>();
  for(const row of lineups) {
    if(!Number.isSafeInteger(row.player_id))continue;
    const rows=byMatch.get(row.game_id)??[];
    rows.push(row);
    byMatch.set(row.game_id,rows);
  }
  const windows=new Map<number,Map<number,{start:number;end:number;from:number;to:number}>>();
  for(const [id,rows] of byMatch){
    const changes=new Map<number,{on?:LineupEvent;off?:LineupEvent}>();
    for(const event of events.get(id)??[]){
      if(event.teamId!==team||event.playerId==null||!["SubstitutionOn","SubstitutionOff"].includes(event.type??""))continue;
      const change=changes.get(event.playerId)??{};
      if(event.type==="SubstitutionOn")change.on=event;else change.off=event;
      changes.set(event.playerId,change);
    }
    const matchWindows=new Map();
    for(const row of rows){
      const change=changes.get(row.player_id);
      const from=starter(row)?0:change?.on?minute(change.on):null;
      const to=change?.off?minute(change.off):
        starter(row)?(row.minutes_played??0)>=90?90:null:
          from!==null&&(row.minutes_played??0)>=Math.max(0,90-Math.floor(from))?90:null;
      if(from!==null&&to!==null&&to>=from){
        matchWindows.set(row.player_id,{start:starter(row)?-Infinity:change!.on!.id,end:change?.off?.id??Infinity,from,to});
      }
    }
    windows.set(id,matchWindows);
  }
  const minutes=(row:LineupRow)=>{
    if(period==="ft")return typeof row.minutes_played==="number"&&row.minutes_played>0?row.minutes_played:0;
    const window=windows.get(row.game_id)?.get(row.player_id);
    if(!window)return 0;
    return Math.max(0,Math.min(window.to,period==="fh"?45:90)-Math.max(window.from,period==="fh"?0:45));
  };
  const templates=new Map(input.templates.map(template=>[template.formation_key,template.positions]));
  const {formations,frequencies,distribution}=recordedFormations(input.formations);
  const mostCommonFormation=distribution[0]?.formation??null;
  const shapeUse=new Map<string,{row:FormationRow;count:number}>();
  const exact=new Map<string,{row:FormationRow;players:LineupRow[];count:number;minutes:number}>();
  let completeLineupMatches=0;
  const slotsFor=(row:FormationRow)=>(templates.get(row.positions)??[]).flatMap(slot=>{
    const point=portraitEventPoint(slot.x,slot.y);
    const position=(slot.position??slot.role??"").trim().toUpperCase();
    // Formation templates place the right flank at higher lateral values.
    return point&&position?[{x:100-point.x,y:point.y,position}]:[];
  });
  for(const row of formations){
    const shapeKey=JSON.stringify([row.formation,row.positions]);
    if(row.formation===mostCommonFormation&&typeof row.positions==="string"){
      const shape=shapeUse.get(row.positions)??{row,count:0};
      shape.count++;
      shapeUse.set(row.positions,shape);
    }
    const players=(byMatch.get(row.game_id)??[]).filter(starter).sort((a,b)=>a.player_id-b.player_id);
    const roles=typeof row.positions==="string"?row.positions.toUpperCase().split("-").sort():[];
    if(players.length!==11||new Set(players.map(player=>player.player_id)).size!==11||
       roles.length!==11||roles.filter(position=>position==="GK").length!==1||
       players.map(role).sort().join("-")!==roles.join("-"))continue;
    completeLineupMatches++;
    if(row.formation!==mostCommonFormation)continue;
    const key=JSON.stringify([shapeKey,players.map(player=>[player.player_id,role(player)])]);
    const entry=exact.get(key)??{row,players,count:0,minutes:0};
    entry.count++;
    entry.minutes+=players.reduce((sum,player)=>sum+Math.max(0,player.minutes_played??0),0);
    exact.set(key,entry);
  }
  const common=[...exact.entries()].sort(([ka,a],[kb,b])=>b.count-a.count||b.minutes-a.minutes||ka.localeCompare(kb))[0]?.[1];
  const chosen=byMinutes?[...shapeUse.values()].sort((a,b)=>
    b.count-a.count||a.row.positions.localeCompare(b.row.positions))[0]?.row:common?.row;
  const scoped=formations.filter(row=>row.formation===chosen?.formation&&row.positions===chosen?.positions);
  const slots=chosen?slotsFor(chosen):[];
  const stats=new Map<number,Map<string,{row:LineupRow;starts:number;minutes:number;games:Set<number>}>>();
  for(const match of scoped){
    for(const row of (byMatch.get(match.game_id)??[]).filter(starter)){
      const roles=stats.get(row.player_id)??new Map();
      const position=role(row);
      const info=roles.get(position)??{row,starts:0,minutes:0,games:new Set<number>()};
      if(info.games.has(match.game_id))continue;
      info.games.add(match.game_id);
      info.starts++;
      info.minutes+=minutes(row);
      roles.set(position,info);
      stats.set(row.player_id,roles);
    }
  }
  const validSlots=slots.length===11&&slots.filter(slot=>slot.position==="GK").length===1;
  const available=validSlots&&common?[...common.players]:[];
  let selected=slots.map(slot=>{
    const index=available.findIndex(player=>role(player)===slot.position);
    return index<0?null:available.splice(index,1)[0].player_id;
  });
  if(byMinutes&&validSlots){
    // Optimize total minutes across recorded roles, with one unique player per slot.
    const size=1<<slots.length;
    const assignments=Array<{minutes:number;starts:number;players:(number|null)[]}|undefined>(size);
    assignments[0]={minutes:0,starts:0,players:slots.map(()=>null)};
    for(const [id,roles] of [...stats].sort(([a],[b])=>a-b)){
      for(let mask=size-1;mask>=0;mask--){
        const current=assignments[mask];
        if(!current)continue;
        slots.forEach((slot,index)=>{
          if(mask&(1<<index))return;
          const info=roles.get(slot.position);
          if(!info?.minutes)return;
          const nextMask=mask|(1<<index);
          const minutes=current.minutes+info.minutes;
          const starts=current.starts+info.starts;
          const previous=assignments[nextMask];
          if(previous&&(previous.minutes>minutes||(previous.minutes===minutes&&previous.starts>=starts)))return;
          const players=[...current.players];
          players[index]=id;
          assignments[nextMask]={minutes,starts,players};
        });
      }
    }
    const best=assignments.filter(item=>item!==undefined).sort((a,b)=>
      b.players.filter(id=>id!==null).length-a.players.filter(id=>id!==null).length||
      b.minutes-a.minutes||b.starts-a.starts)[0];
    selected=best.players;
  }
  const missingRoles=validSlots?slots.filter((_,index)=>selected[index]===null).map(slot=>slot.position):["Nominal formation slots"];
  const lineup:SpatialLineup={formation:mostCommonFormation,
    formationCount:frequencies.get(mostCommonFormation??"")??0,formationMatches:formations.length,scopedMatches:scoped.length,
    lineupCount:byMinutes?null:common?.count??null,completeLineupMatches,distribution,missingRoles,selectedPlayers:selected.filter(id=>id!==null).length};
  const rolesByPlayer=new Map<number,string>();
  selected.forEach((id,index)=>{if(id!==null)rolesByPlayer.set(id,slots[index].position);});
  const passingOutcomes=new Map<number,{known:number;completed:number}>();
  const location=new Map<number,{x:number;y:number;count:number}>();
  const edges=new Map<string,{from:number;to:number;count:number;confirmed:number;estimated:number;sharedMinutes:number}>();
  const covered=new Set<number>();
  let invalid=0;
  const selectedIds=[...rolesByPlayer.keys()];
  for(const match of scoped){
    const matchEvents=events.get(match.game_id)??[];
    const matchWindows=windows.get(match.game_id);
    const positionMatch=(id:number)=>rolesByPlayer.has(id)&&stats.get(id)?.get(rolesByPlayer.get(id)!)?.games.has(match.game_id);
    const selectedHere=selectedIds.filter(positionMatch);
    const active=(id:number,eventId:number)=>{
      const window=matchWindows?.get(id);
      return Boolean(window&&eventId>=window.start&&eventId<window.end);
    };
    const periodEvents=matchEvents.filter(event=>inPeriod(event,period));
    for(const event of periodEvents){
      if(event.teamId!==team||event.playerId==null||!positionMatch(event.playerId)||
          (matchWindows?.has(event.playerId)&&!active(event.playerId,event.id)))continue;
      if(mode==="network"&&event.category==="passing"&&typeof event.passSuccessful==="boolean"){
        const outcomes=passingOutcomes.get(event.playerId)??{known:0,completed:0};
        outcomes.known++;
        if(event.passSuccessful)outcomes.completed++;
        passingOutcomes.set(event.playerId,outcomes);
      }
      const point=portraitEventPoint(event.x,event.y);
      if(!point){if(event.x!=null||event.y!=null)invalid++;continue;}
      covered.add(match.game_id);
      const value=location.get(event.playerId)??{x:0,y:0,count:0};
      value.x+=point.x;value.y+=point.y;value.count++;
      location.set(event.playerId,value);
    }
    if(mode!=="network")continue;
    for(const from of selectedHere)for(const to of selectedHere){
      if(from===to)continue;
      const a=matchWindows?.get(from),b=matchWindows?.get(to);
      if(!a||!b)continue;
      const shared=Math.max(0,Math.min(a.to,b.to,period==="fh"?45:90)-Math.max(a.from,b.from,period==="sh"?45:0));
      if(!shared)continue;
      const key=`${from}:${to}`;
      const edge=edges.get(key)??{from,to,count:0,confirmed:0,estimated:0,sharedMinutes:0};
      edge.sharedMinutes+=shared;
      edges.set(key,edge);
    }
    const network=buildPassingNetwork(periodEvents,team,(pass,recipient)=>
      pass.playerId!==recipient.playerId&&!!positionMatch(pass.playerId!)&&!!positionMatch(recipient.playerId!)&&
      active(pass.playerId!,pass.id)&&active(recipient.playerId!,pass.id)&&active(recipient.playerId!,recipient.id));
    for(const edge of network.edges){
      const current=edges.get(`${edge.from}:${edge.to}`);
      if(!current)continue;
      current.count+=edge.count;current.confirmed+=edge.confirmed;current.estimated+=edge.estimated;
    }
  }
  const markers:SpatialMarker[]=selected.flatMap((id,index)=>{
    if(id===null)return [];
    const slot=slots[index], info=stats.get(id)?.get(slot.position);
    const loc=location.get(id);
    if(!info||(mode!=="lineup"&&!loc))return [];
    // Keep the goalkeeper label inside the pitch when the provider's template is on the goal line.
    const point=mode==="lineup"?{x:Math.max(3,Math.min(97,slot.x)),y:Math.max(2,Math.min(98,slot.y))}:
      {x:loc!.x/loc!.count,y:loc!.y/loc!.count};
    const player=info.row.player_name??`Player ${id}`;
    return [{...point,key:String(id),player,position:slot.position,number:info.row.jersey_number,
      label:`${player} · ${slot.position}`,starts:info.starts,minutes:info.minutes,eventCount:loc?.count??0,passOutcomes:passingOutcomes.get(id)}];
  });
  return {lineup,markers,covered:mode==="lineup"?scoped.filter(item=>byMatch.has(item.game_id)).length:covered.size,invalid,
    count:markers.reduce((sum,marker)=>sum+(marker.eventCount??0),0),
    edges:[...edges.values()].filter(edge=>edge.count>0)};
}
