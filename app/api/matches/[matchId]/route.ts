import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";

const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

export async function GET(_: Request, {params}:{params:Promise<{matchId:string}>}) {
  const gameId=Number((await params).matchId);
  if(!Number.isInteger(gameId))return NextResponse.json({error:"Invalid match id."},{status:400});
  try {
    const started=performance.now();
    const db=await database();
    const [schedule,statRows,shotRows,lineupRows,teams,formationRows]=await Promise.all([
      db.collection("game_schedule").findOne({game_id:gameId,competition_name:"Bundesliga"},{projection:{_id:0,game_id:1,season:1,week:1,game_date:1,home_team_id:1,away_team_id:1,home_team_name:1,away_team_name:1,home_goals:1,away_goals:1,game_status:1,venue:1,attendance:1,home_manager:1,away_manager:1}}),
      db.collection("game_team_stats").find({game_id:gameId},{projection:{_id:0,game_id:1,team_id:1,stats:1}}).toArray(),
      db.collection("game_processed_events").find({game_id:gameId,categories:"shot"},{projection:{_id:0,event_idx:1,team_id:1,team:1,player_id:1,player:1,minute:1,second:1,period:1,x:1,y:1,end_x:1,end_y:1,shot_result:1,shot_goal:1,shot_on_target:1,shot_blocked:1,shot_woodwork:1,shot_own_goal:1,shot_situation:1,outcome_type:1,categories:1}}).sort({event_idx:1}).toArray(),
      db.collection("game_lineups").find({game_id:gameId,competition_name:"Bundesliga"},{projection:{_id:0,team_id:1,player_id:1,player_name:1,jersey_number:1,starting_lineup:1,starting_position:1,lineup_order:1,formation_slot:1}}).toArray(),
      db.collection("available_teams").find({},{projection:{_id:0,ws_team_id:1,team_logo:1}}).toArray(),
      db.collection("game_formations").find({game_id:gameId,competition_name:"Bundesliga"},{projection:{_id:0,team_id:1,formation:1,positions:1}}).toArray()
    ]);
    if(!schedule)return NextResponse.json({error:"Match not found."},{status:404});
    const teamMeta=new Map(teams.filter(t=>typeof t.ws_team_id==="number").map(t=>[t.ws_team_id,t.team_logo]));
    const stats=statRows.map(row=>({teamId:row.team_id,periods:row.stats??{}}));
    const shots=shotRows.map(row=>({
      id:row.event_idx,teamId:row.team_id,teamName:row.team,playerId:row.player_id,playerName:row.player,
      minute:finite(row.minute),second:finite(row.second),period:row.period,x:finite(row.x),y:finite(row.y),endX:finite(row.end_x),endY:finite(row.end_y),
      result:typeof row.shot_result==="string"?row.shot_result:null,goal:Boolean(row.shot_is_goal),onTarget:Boolean(row.shot_on_target),offTarget:Boolean(row.shot_off_target),blocked:Boolean(row.shot_blocked),woodwork:Boolean(row.shot_woodwork),ownGoal:Boolean(row.shot_own_goal),situation:typeof row.shot_situation==="string"?row.shot_situation:null
    }));
    const startingRows=lineupRows.filter(row=>row.starting_lineup===true||row.starting_lineup===1);
    const lineups=startingRows.map((row,index)=>({teamId:row.team_id,playerId:row.player_id,name:row.player_name,number:row.jersey_number,position:row.starting_position,lineupOrder:typeof row.lineup_order==="number"?row.lineup_order:typeof row.formation_slot==="number"?row.formation_slot:index}));
    const playerNumbers:Record<string,number|null>={};for(const row of lineupRows){if(typeof row.player_id==="number")playerNumbers[String(row.player_id)]=typeof row.jersey_number==="number"?row.jersey_number:null;}
    const formationKeys=formationRows.flatMap(row=>typeof row.positions==="string"?[row.positions]:[]).filter(Boolean);
    const templateRows=formationKeys.length?await db.collection("formation_coordinates").find({$or:[{formation_key:{$in:formationKeys}},{formation_name:{$in:formationRows.map(row=>row.formation).filter(Boolean)}}]},{projection:{_id:0,formation_id:1,formation_name:1,formation_key:1,positions:1}}).toArray():[];
    const formations=formationRows.map(row=>{
      const key=typeof row.positions==="string"?row.positions:null;
      const template=key?templateRows.find(item=>item.formation_key===key):templateRows.find(item=>item.formation_name===row.formation);
      const players=lineups.filter(player=>player.teamId===row.team_id).sort((left,right)=>left.lineupOrder-right.lineupOrder);
      const slots=Array.isArray(template?.positions)?template.positions:[];
      const used=new Set<number>();
      const roleCursor=new Map<string,number>();
      const mapped=players.map((player,index)=>{
        const role=typeof player.position==="string"?player.position.trim().toUpperCase():"";
        const occurrence=roleCursor.get(role)??0;
          const roleSlots=slots.map((candidate,slotIndex)=>({candidate,slotIndex})).filter(item=>String(item.candidate?.role??item.candidate?.position??"").trim().toUpperCase()===role&&!used.has(item.slotIndex));
        const selected=roleSlots[occurrence]??roleSlots[0];
        const slot=selected?.candidate;
        const slotIndex=selected?.slotIndex??-1;if(slotIndex>=0){used.add(slotIndex);roleCursor.set(role,occurrence+1);}
        return {playerId:player.playerId,name:player.name,number:player.number,teamId:player.teamId,position:player.position,x:finite(slot?.x),y:finite(slot?.y),slotIndex};
      });
      return {teamId:row.team_id,formationName:row.formation??template?.formation_name??null,formationKey:key,templateFound:Boolean(template),players:mapped};
    });
    const cacheable=/(finished|complete|played|full.?time)/i.test(String(schedule.game_status??""));
    return NextResponse.json({match:{id:gameId,season:schedule.season,week:schedule.week,date:schedule.game_date,homeId:schedule.home_team_id,awayId:schedule.away_team_id,home:schedule.home_team_name,away:schedule.away_team_name,homeGoals:finite(schedule.home_goals),awayGoals:finite(schedule.away_goals),status:schedule.game_status,venue:schedule.venue??"",attendance:finite(schedule.attendance),homeManager:typeof schedule.home_manager==="string"?schedule.home_manager:null,awayManager:typeof schedule.away_manager==="string"?schedule.away_manager:null},stats,shots,lineups,playerNumbers,formations,logos:{[schedule.home_team_name]:teamMeta.get(schedule.home_team_id)??null,[schedule.away_team_name]:teamMeta.get(schedule.away_team_id)??null}}, {headers:{"Cache-Control":cacheable?"private, max-age=300, stale-while-revalidate=3600":"no-store","Server-Timing":`report;dur=${(performance.now()-started).toFixed(1)}`} });
  } catch(error) {
    console.error("Match report unavailable:",error instanceof Error?error.name:"Unknown error");
    return NextResponse.json({error:"The match report is unavailable."},{status:503});
  }
}
