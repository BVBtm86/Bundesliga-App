import {spatialStageRows} from "@/lib/spatial-stage";
import { NextResponse } from "next/server";
import { classifyTacticalPass } from "@/lib/tactical-passing";
import { aggregateSpatialLineup, recordedFormations, type FormationRow, type FormationTemplate, type LineupRow, type LineupEvent } from "@/lib/season-spatial-lineup";
import { shotOutcome, spatialShot, type ShotQualifiers, type SpatialShot } from "@/lib/spatial-shots";
import { database } from "@/lib/mongo";
import {
  defensiveCategories, eventCategories, portraitEventPoint, sharedComparisonDensity,
  shotOutcomes, spatialCategory, spatialModes, type SpatialComparisonData, type SpatialFixture,
  type SpatialMarker, type SpatialPoint
} from "@/lib/spatial-density";

export const dynamic = "force-dynamic";

type SpatialEvent = {
  game_id: number; event_idx: number; player_id?: number; player?: string; minute?: number;
  team_id: number; period: string; type?:string; categories?: string[]; x?: number; y?: number;
  second?:number; recipient_id?:number; pass_recipient_id?:number; related_player_id?:number; pass_completed?:boolean; pass_successful?:boolean;
  end_x?: number; end_y?: number; pass_attempt?: boolean;
  shot_goal?: boolean; shot_blocked?: boolean; shot_on_target?: boolean; shot_own_goal?:boolean; shot_woodwork?:boolean; shot_result?: string;
  goal_mouth_y?:number|null; goal_mouth_z?:number|null; blocked_x?:number|null; blocked_y?:number|null;
};

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const season = p.get("season") ?? "";
  const team = Number(p.get("team"));
  const from = Number(p.get("from") ?? 1);
  const to = Number(p.get("to") ?? 34);
  const venue = p.get("venue") ?? "all";
  const mode = p.get("mode") ?? "events";
  const selection=p.get("lineup")??"common";
  const period = p.get("period") ?? "ft";
  const category = p.get("category") ?? "all";
  const shot = p.get("shot") ?? "all";
  const basis=p.get("basis")??"perMatch",comparisonSeason=p.get("comparisonSeason")??season;
  if (!/^\d{4}-\d{4}$/.test(season) || season < "2009-2010" || Number(season.slice(5)) !== Number(season.slice(0, 4)) + 1 ||
      ![team, from, to].every(Number.isSafeInteger) || team < 1 || from < 1 || to < from || to > 100 ||
      !["stage","perMatch"].includes(basis)||(basis==="stage"&&(!/^\d{4}-\d{4}$/.test(comparisonSeason)||comparisonSeason<"2009-2010"||Number(comparisonSeason.slice(5))!==Number(comparisonSeason.slice(0,4))+1))||
      (selection!=="common"&&selection!=="minutes") ||
      !["ft","fh","sh"].includes(period) || !["all", "home", "away"].includes(venue) || !spatialModes.some(value => value === mode) ||
      !eventCategories.some(value => value === category) || !shotOutcomes.some(value => value === shot)) {
    return NextResponse.json({error: "Choose valid spatial comparison filters."}, {status: 400});
  }
  try {
    const db = await database();
    const rows = await db.collection("game_schedule").find({
      competition_name: "Bundesliga", competition_country: "Germany", season:basis==="stage"?{$in:[season,comparisonSeason]}:season, game_status: "finished",
      week: {$gte: from, $lte: to},
      $or: [...(venue !== "away" ? [{home_team_id: team}] : []), ...(venue !== "home" ? [{away_team_id: team}] : [])]
    }, {projection: {_id:0, game_id:1, week:1, season:1, game_date:1, home_goals:1, away_goals:1, home_team_id:1, home_team_name:1, away_team_name:1}}).sort({week:-1}).toArray();
    const sampledRows=basis==="stage"?spatialStageRows(rows as (typeof rows[number]&{game_id:number})[],season,comparisonSeason):rows;
    const matches: SpatialFixture[] = sampledRows.filter(row => Number.isSafeInteger(row.game_id)).map(row => ({
      id: row.game_id, week: row.week, opponent: row.home_team_id === team ? row.away_team_name : row.home_team_name,
      venue: row.home_team_id === team ? "home" : "away"
    }));
    const playerView=mode==="lineup"||mode==="average"||mode==="network";
    const gameIds=matches.map(match=>match.id);
    const events = db.collection<SpatialEvent>("game_processed_events_app").find({
      game_id: {$in: gameIds}, ...(mode==="network"?{}:{team_id:team}),
      period: {$in: !playerView&&period==="fh"?["FirstHalf"]:!playerView&&period==="sh"?["SecondHalf"]:["FirstHalf","SecondHalf"]}
    }, {projection: {_id:0, game_id:1,event_idx:1,team_id:1,player_id:1,player:1,type:1,categories:1,x:1,y:1,end_x:1,end_y:1,pass_attempt:1,shot_goal:1,shot_blocked:1,shot_on_target:1,shot_result:1,shot_own_goal:1,shot_woodwork:1,goal_mouth_y:1,goal_mouth_z:1,blocked_x:1,blocked_y:1,minute:1,second:1,recipient_id:1,pass_recipient_id:1,pass_completed:1,pass_successful:1,period:1}});
    const rawShots=mode==="shots"?await db.collection<{game_id:number;event_idx:number;qualifiers?:ShotQualifiers}>("game_raw_events")
      .find({game_id:{$in:gameIds},team_id:team,is_shot:true},{projection:{_id:0,game_id:1,event_idx:1,qualifiers:1}}).toArray():[];
    const qualifiers=new Map(rawShots.map(row=>[`${row.game_id}:${row.event_idx}`,row.qualifiers??[]]));
    const shots:SpatialShot[]=[];
    const lineupEvents=new Map<number,LineupEvent[]>();
    const covered = new Set<number>();
    const seen = new Map<number, Set<number>>();
    const points: SpatialPoint[] = [];
    const markers: SpatialMarker[] = [];
    let invalid = 0;
    let count = 0;
    for await (const event of events) {
      if (request.signal.aborted) break;
      if (!Number.isSafeInteger(event.event_idx)) continue;
      const ids = seen.get(event.game_id) ?? new Set<number>();
      if (ids.has(event.event_idx)) continue;
      ids.add(event.event_idx);
      seen.set(event.game_id, ids);
      const kind = spatialCategory(event);
      if(playerView){
        const matchEvents=lineupEvents.get(event.game_id)??[];
        matchEvents.push({id:event.event_idx,teamId:event.team_id,playerId:event.player_id,type:event.type,
          recipientId:event.recipient_id??event.pass_recipient_id,minute:event.minute,second:event.second,
          period:event.period,category:kind,x:event.x,y:event.y,endX:event.end_x,endY:event.end_y,
          passSuccessful:event.pass_completed??event.pass_successful});
        lineupEvents.set(event.game_id,matchEvents);
        continue;
      }
      if(event.team_id!==team)continue;
      const point = portraitEventPoint(event.x, event.y);
      if(mode!=="shots"&&event.x===0&&event.y===0&&
        (event.categories?.some(category=>category==="substitution"||category==="card")||
          ["SubstitutionOn","SubstitutionOff","Card"].includes(event.type??"")))continue;
      if (point) covered.add(event.game_id);
      const shotResult = mode === "shots" ? shotOutcome(event) : "";
      const keep = mode === "shots" ? kind === "shots" && (shot === "all" || shot === shotResult) :
        mode === "passing" ? kind === "passing" :
        mode === "progressive" ? kind==="passing" && event.pass_attempt===true && !!classifyTacticalPass(event)?.progressive :
        mode === "defending" ? defensiveCategories.some(value => value === kind) && (category === "all" || kind === category) :
        category === "final-third" ? !!point&&point.y<=100/3 :
        category === "progressive" ? kind==="passing" && event.pass_attempt===true && !!classifyTacticalPass(event)?.progressive :
        category === "offside" ? kind==="offside"&&event.type==="OffsideGiven" :
        category === "defensive" ? defensiveCategories.some(value=>value===kind) :
        category === "all" || kind === category;
      if (!keep) continue;
      if(mode==="shots")shots.push(spatialShot(event,qualifiers.get(`${event.game_id}:${event.event_idx}`)??[]));
      if (!point) { invalid++; continue; }
      if (mode === "shots") {
        markers.push({...point, key: `${event.game_id}:${event.event_idx}`, outcome: shotResult, matchId:event.game_id, player:event.player,
          minute: typeof event.minute === "number" ? event.minute : undefined,
          label: `Match ${event.game_id} · ${event.player ?? "Player unavailable"} · ${shotResult}${typeof event.minute === "number" ? ` · ${event.minute}′` : ""}`});
      } else points.push(point);
      count++;
    }
    const formations=await db.collection<FormationRow>("game_formations").find(
      {game_id:{$in:gameIds},team_id:team},{projection:{_id:0,game_id:1,formation:1,positions:1}}).toArray();
    let result:SpatialComparisonData;
    if(playerView){
      const lineups=await db.collection<LineupRow>("game_lineups").find(
        {game_id:{$in:gameIds},team_id:team},{projection:{_id:0,game_id:1,player_id:1,player_name:1,jersey_number:1,starting_lineup:1,starting_position:1,minutes_played:1}}).toArray();
      const templates=await db.collection<FormationTemplate>("formation_coordinates").find(
        {formation_key:{$in:formations.map(row=>row.positions).filter(value=>typeof value==="string")}},
        {projection:{_id:0,formation_key:1,positions:1}}).toArray();
      const aggregate=aggregateSpatialLineup({team,period,selection,formations,templates,lineups,events:lineupEvents,mode});
      result={matches,selectedMatch:null,eligible:matches.length,density:[],...aggregate};
    }else{
      const history=recordedFormations(formations);
      result={matches,selectedMatch:null,eligible:matches.length,covered:covered.size,invalid,count,
        formationDistribution:{matches:history.formations.length,rows:history.distribution},
        density:mode==="shots"?[]:sharedComparisonDensity(points,covered.size),markers,shots:mode==="shots"?shots:undefined};
    }
    return NextResponse.json(result, {headers:{"Cache-Control":"private, max-age=60"}});
  } catch (error) {
    console.error("Team spatial comparison unavailable:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({error:"Spatial event data is temporarily unavailable."}, {status:503});
  }
}
