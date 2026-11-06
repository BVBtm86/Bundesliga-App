import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";
import type { TimelineEvent } from "@/lib/types";

const eventMinute = (event: any) => {
  const minute=typeof event.minute === "number" ? event.minute : null;
  const added=typeof event.added_time === "number" ? event.added_time : 0;
  const expanded=typeof event.expanded_minute === "number" ? event.expanded_minute : minute;
  if (minute === null) return "—";
  return added>0 ? `${minute}+${added}'` : expanded && expanded > minute ? `${minute}+${expanded-minute}'` : `${minute}'`;
};

export async function GET(_: Request, {params}:{params:Promise<{matchId:string}>}) {
  const matchId=Number((await params).matchId);
  if (!Number.isInteger(matchId)) return NextResponse.json({error:"Invalid match id."},{status:400});
  const started=performance.now();
  const db=await database();
  const [source, assistRows, schedule]=await Promise.all([
    db.collection("game_key_events").find({game_id:matchId},{projection:{_id:1,game_date:1,event_id:1,team_id:1,player_id:1,player_name:1,minute:1,second:1,added_time:1,period:1,event_type:1,event_subtype:1,related_player_id:1,related_player_name:1,assist_player_id:1,assist_player_name:1}}).sort({minute:1,second:1,event_id:1}).toArray(),
    db.collection("game_processed_events").find({game_id:matchId,shot_goal:1},{projection:{_id:0,event_idx:1,related_player_id:1}}).toArray(),
    db.collection("game_schedule").findOne({game_id:matchId,competition_name:"Bundesliga"},{projection:{_id:0,home_team_id:1,away_team_id:1,home_team_name:1,away_team_name:1}})
  ]);
  const assistIds=assistRows.map(row=>row.related_player_id).filter((id):id is number=>typeof id==="number");
  const assistNames=assistIds.length?await db.collection("game_processed_events").find({game_id:matchId,player_id:{$in:assistIds}},{projection:{_id:0,player_id:1,player:1}}).toArray():[];
  const playerNames=new Map<number,string>();for(const row of assistNames){if(typeof row.player_id==="number"&&typeof row.player==="string")playerNames.set(row.player_id,row.player);}
  const assistByEvent=new Map<number,string>();for(const row of assistRows){if(typeof row.event_idx==="number"&&typeof row.related_player_id==="number"){const name=playerNames.get(row.related_player_id);if(name)assistByEvent.set(row.event_idx,name);}}
  const events:TimelineEvent[]=[];
  for(const event of source) {
    const scoringTeamId=event.event_subtype==="own_goal"&&schedule
      ? event.team_id===schedule.home_team_id?schedule.away_team_id:schedule.home_team_id
      : event.team_id;
    const playerTeamName=schedule
      ? event.team_id===schedule.home_team_id?schedule.home_team_name:event.team_id===schedule.away_team_id?schedule.away_team_name:null
      : null;
    const base={id:String(event.event_id),teamId:scoringTeamId,minute:eventMinute(event),second:typeof event.second==="number"?event.second:null,period:typeof event.period==="string"?event.period:null,playerId:typeof event.player_id==="number"?event.player_id:null,relatedPlayerId:typeof event.related_player_id==="number"?event.related_player_id:null,player:typeof event.player_name==="string"?event.player_name:null,playerTeamName,ownGoal:event.event_subtype==="own_goal",assist:typeof event.assist_player_name==="string"?event.assist_player_name:typeof event.event_id==="number"?assistByEvent.get(event.event_id)??null:null};
    if(event.event_type==="goal") events.push({...base,type:"goal",detail:event.event_subtype==="own_goal"?"Own goal":event.event_subtype==="penalty"?"Penalty":"Goal"});
    else if(event.event_type==="missed_penalty") events.push({...base,type:"penalty-miss",detail:"Missed penalty"});
    else if(event.event_type==="card" && event.event_subtype==="second_yellow") events.push({...base,type:"second-yellow",detail:"Second yellow"});
    else if(event.event_type==="card" && event.event_subtype==="red") events.push({...base,type:"red",detail:"Red card"});
    else if(event.event_type==="card" && event.event_subtype==="yellow") events.push({...base,type:"yellow",detail:"Yellow card"});
    else if(event.event_type==="substitution") events.push({...base,type:"substitution",replacement:typeof event.related_player_name==="string"?event.related_player_name:null,detail:"Substitution"});
  }
  return NextResponse.json({events,sourceCount:source.length,gameDate:source.find((event)=>event.game_date)?.game_date ?? null},{headers:{"Cache-Control":"private, max-age=60, stale-while-revalidate=300","Server-Timing":`events;dur=${(performance.now()-started).toFixed(1)}`} });
}
