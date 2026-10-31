import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";
import { standings } from "@/lib/analytics";
import { PERIODS } from "@/lib/filters";
import { buildHistoricalPositions } from "@/lib/historical-positions";
import type { Match, MatchStats, MatchPeriod, MatchStatus, PeriodStats, SeasonConfig, SeasonOutcomeClassification } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const matchStatus = (value: unknown): MatchStatus => {
  const status=typeof value === "string" ? value.toLowerCase() : "";
  if(status === "finished") return "finished";
  if(/live|in.?play|half/.test(status)) return "live";
  if(/postponed|suspended/.test(status)) return "postponed";
  if(/cancelled|canceled|abandoned/.test(status)) return "cancelled";
  return status ? "scheduled" : "unknown";
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = params.get("season");
  const includeHistory = params.get("includeHistory") === "1";
  if (requested && !/^\d{4}-\d{4}$/.test(requested))
    return NextResponse.json({error:"Choose a valid season."},{status:400});
  try {
    const db = await database();
    const filter = {competition_name:"Bundesliga", competition_country:"Germany"};
    const [scheduleSeasons, historicalSeasons] = await Promise.all([
      db.collection("game_schedule").distinct("season", filter),
      db.collection("historical_results").distinct("season", {}).catch(() => [] as unknown[])
    ]);
    const seasons = [...new Set([...scheduleSeasons, ...historicalSeasons])]
      .filter((s): s is string => typeof s === "string" && /^\d{4}-\d{4}$/.test(s)).sort().reverse();
    if (!seasons.length)
      return NextResponse.json({error:"No Bundesliga schedule data has been imported yet. Refresh after the import reaches game_schedule."},{status:404});
    const season = requested ?? seasons[0];
    if (!seasons.includes(season))
      return NextResponse.json({error:"This season has no imported schedule."},{status:404});
    const scheduleProjection = {
      _id:0,game_id:1,season:1,game_date:1,week:1,home_team_id:1,away_team_id:1,
      home_team_name:1,away_team_name:1,home_goals:1,away_goals:1,game_status:1,venue:1,attendance:1
    };
    const [schedule, historicalSchedule, historicalResults, rows, availableTeams, seasonConfigRows] = await Promise.all([
      db.collection("game_schedule").find({...filter,season}, {projection:{
        _id:0,game_id:1,season:1,game_date:1,week:1,home_team_id:1,away_team_id:1,
        home_team_name:1,away_team_name:1,home_goals:1,away_goals:1,game_status:1,venue:1,attendance:1
      }}).limit(1000).toArray(),
      db.collection("game_schedule").find({...filter,game_status:"finished"},{projection:scheduleProjection}).sort({game_date:-1}).limit(10000).toArray(),
      db.collection("historical_results").find({season:includeHistory?{$in:seasons}:season},{projection:{_id:1,season:1,week:1,game_date:1,home_team_id:1,away_team_id:1,home_team_name:1,away_team_name:1,home_team_goals:1,away_team_goals:1,home_team_goals_ft:1,away_team_goals_ft:1,cancelled:1}}).sort({game_date:-1}).limit(includeHistory?50000:2000).toArray().catch(() => [] as any[]),
      db.collection("game_team_stats").find({...filter,season}, {projection:Object.fromEntries([
        ["_id",0],["game_id",1],["team_id",1],
        ...PERIODS.flatMap(p=>["goals","own_goals","shots","shot_on_target","shot_off_target","shot_blocked","shot_woodwork","shot_zone_inside_box","shot_zone_outside_box","shot_set_piece","shot_fastbreak","shot_open_play","shot_penalty","possession","touches","loss_of_possession","dispossessed","turnover","pass_attempt","pass_completed","pass_completion_pct","pass_key_pass","pass_assist","pass_through_ball","pass_forward","pass_backward","pass_cross","pass_cross_completed","pass_cross_completion_pct","pass_corner","pass_long","pass_long_completed","pass_long_completion_pct","pass_final_third","pass_final_third_completed","pass_final_third_completion_pct","tackles_attempted","tackle_gained_possession","tackle_success_pct","interceptions","clearances","blocks","blocked_shot","errors","ball_recoveries","dribbles","dribble_successful","offsides","foul_suffered","foul_committed","aerial_duels","aerial_duel_won","saves","goalkeeper_actions","claims","punches","keeper_pickup","keeper_sweeper","cards","yellow_card","second_yellow_card","red_card","shot_accuracy","goal_conversion_pct"].map(key=>["stats."+p.value+"."+key,1]))
      ])}).limit(2000).toArray(),
      db.collection("available_teams").find({}, {projection:{_id:0,ws_team_id:1,ws_team_name:1,fbre_team_name:1,short_name:1,team_name:1,team_logo:1,stadium_logo:1,stadium_name:1,city:1,state:1,latitude:1,longitude:1}}).limit(1000).toArray(),
      db.collection("season_config").find({season:{$in:seasons}},{projection:{_id:0,competition:1,season:1,start_year:1,end_year:1,rules:1,points:1,standings_tiebreakers:1,standingsTiebreakers:1,data_availability:1,dataAvailability:1,summary:1,outcomes:1,classifications:1,champion_team_id:1,championTeamId:1,relegated_team_ids:1,relegatedTeamIds:1,promoted_team_ids:1,promotedTeamIds:1}}).toArray().catch(() => [] as any[])
    ]);
    const goalRows = await db.collection("game_key_events").find({game_id:{$in:schedule.filter(d=>typeof d.game_id === "number").map(d=>d.game_id)},event_type:"goal"},{projection:{_id:0,game_id:1,team_id:1,player_name:1,minute:1,added_time:1,event_subtype:1}}).sort({minute:1}).toArray();
    const teamMeta = new Map(availableTeams.filter(d=>typeof d.ws_team_id === "number").map(d=>[d.ws_team_id,d]));
    const teamMetaByName = new Map<string, any>();
    for (const meta of availableTeams) {
      for (const value of [meta.ws_team_name, meta.fbre_team_name, meta.short_name, meta.team_name]) {
        if (typeof value === "string" && value.trim()) teamMetaByName.set(normalize(value), meta);
      }
    }
    const historicalMatchId = (value: unknown, index: number) => {
      const source = String(value ?? index);
      let hash = 2166136261;
      for (const character of source) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
      return -(Math.abs(hash) || index + 1);
    };
    const mapMatch = (d: any): Match => {
      const parsedDate = new Date(d.game_date);
      return {
        id:d.game_id, season:typeof d.season === "string" ? d.season : season, date:Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString(),
        week:number(d.week) ?? 0, homeId:d.home_team_id, awayId:d.away_team_id,
        home:d.home_team_name ?? "Unknown team", away:d.away_team_name ?? "Unknown team",
        homeGoals:number(d.home_goals), awayGoals:number(d.away_goals),
        finished:d.game_status === "finished", status:matchStatus(d.game_status), venue:typeof d.venue === "string" && d.venue.trim() ? d.venue : (teamMeta.get(d.home_team_id)?.stadium_name ?? ""),
        attendance:typeof d.attendance === "number" && Number.isInteger(d.attendance) && d.attendance>=0 ? d.attendance : null
      };
    };
    const mapHistoricalMatch = (d: any, index: number): Match => {
      const parsedDate = new Date(d.game_date);
      const homeGoals = number(d.home_team_goals ?? d.home_team_goals_ft);
      const awayGoals = number(d.away_team_goals ?? d.away_team_goals_ft);
      return {
        id: historicalMatchId(d._id, index), season: d.season, date: Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString(),
        week: number(d.week) ?? 0, homeId: d.home_team_id, awayId: d.away_team_id,
        home: d.home_team_name ?? "Unknown team", away: d.away_team_name ?? "Unknown team",
        homeGoals, awayGoals,
        finished: d.cancelled !== true && homeGoals !== null && awayGoals !== null,
        status: d.cancelled === true ? "cancelled" : "finished", venue: teamMeta.get(d.home_team_id)?.stadium_name ?? "", attendance: null, historical: true
      };
    };
    const selectedHistorical = historicalResults.filter(d => d.season === season).map((d, index) => mapHistoricalMatch(d, index));
    const matches: Match[] = [...new Map([...schedule.filter(d => typeof d.game_id === "number").map(d => {
      const m=mapMatch(d); return [m.id,m] as const;
    }), ...selectedHistorical.map(m => [m.id,m] as const)]).values()].sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id);
    const historicalMatches: Match[] = [...new Map([...historicalSchedule.filter(d=>typeof d.game_id === "number").map(d=>{
      const m=mapMatch(d); return [m.id,m] as const;
    }), ...historicalResults.map((d, index) => { const m=mapHistoricalMatch(d, index); return [m.id,m] as const; } )]).values()].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
    const stats: MatchStats[] = [...new Map(rows.map(d => {
      const periods:Partial<Record<MatchPeriod,PeriodStats>>={};
      for(const p of PERIODS) {
        const raw=d.stats?.[p.value];
        if(!raw)continue;
        periods[p.value]={goals:number(raw.goals),ownGoals:number(raw.own_goals),shots:number(raw.shots),shotsOffTarget:number(raw.shot_off_target),blockedShots:number(raw.shot_blocked),woodwork:number(raw.shot_woodwork),onTarget:number(raw.shot_on_target),insideBoxShots:number(raw.shot_zone_inside_box),outsideBoxShots:number(raw.shot_zone_outside_box),setPieceShots:number(raw.shot_set_piece),fastbreakShots:number(raw.shot_fastbreak),openPlayShots:number(raw.shot_open_play),penaltyShots:number(raw.shot_penalty),possession:number(raw.possession),touches:number(raw.touches),lossOfPossession:number(raw.loss_of_possession),dispossessed:number(raw.dispossessed),turnovers:number(raw.turnover),passes:number(raw.pass_attempt),completedPasses:number(raw.pass_completed),passCompletion:number(raw.pass_completion_pct),keyPasses:number(raw.pass_key_pass),assists:number(raw.pass_assist),throughBalls:number(raw.pass_through_ball),forwardPasses:number(raw.pass_forward),backwardPasses:number(raw.pass_backward),crosses:number(raw.pass_cross),completedCrosses:number(raw.pass_cross_completed),crossCompletion:number(raw.pass_cross_completion_pct),longPasses:number(raw.pass_long),completedLongPasses:number(raw.pass_long_completed),longPassAccuracy:number(raw.pass_long_completion_pct),finalThirdPasses:number(raw.pass_final_third),completedFinalThirdPasses:number(raw.pass_final_third_completed),finalThirdCompletion:number(raw.pass_final_third_completion_pct),corners:number(raw.pass_corner),tackles:number(raw.tackles_attempted),successfulTackles:number(raw.tackle_gained_possession),tackleSuccess:number(raw.tackle_success_pct),interceptions:number(raw.interceptions),clearances:number(raw.clearances),blocks:number(raw.blocks),blockedShot:number(raw.blocked_shot),errors:number(raw.errors),recoveries:number(raw.ball_recoveries),dribbles:number(raw.dribbles),successfulDribbles:number(raw.dribble_successful),offsides:number(raw.offsides),foulsWon:number(raw.foul_suffered),foulsCommitted:number(raw.foul_committed),aerialDuels:number(raw.aerial_duels),aerialDuelsWon:number(raw.aerial_duel_won),saves:number(raw.saves),goalkeeperActions:number(raw.goalkeeper_actions),claims:number(raw.claims),punches:number(raw.punches),keeperPickup:number(raw.keeper_pickup),keeperSweeper:number(raw.keeper_sweeper),yellowCards:number(raw.cards ?? raw.yellow_card),secondYellowCards:number(raw.second_yellow_card),foulsSuffered:number(raw.foul_suffered),redCards:number(raw.red_card),shotAccuracy:number(raw.shot_accuracy),goalConversion:number(raw.goal_conversion_pct)};
      }
      const ft=periods.ft;
      const row: MatchStats={...ft,gameId:d.game_id,teamId:d.team_id,shots:ft?.shots??null,onTarget:ft?.onTarget??null,possession:ft?.possession??null,passes:ft?.passes??null,passCompletion:ft?.passCompletion??null,periods};
      return [row.gameId+":"+row.teamId,row] as const;
    })).values()];
    const logos: Record<string,string> = {};
    const fullTeamNames: Record<string,string> = {};
    const shortTeamNames: Record<string,string> = {};
    const stadiums: Record<string,string> = {};
    for (const m of [...matches,...historicalMatches]) for (const [id,name] of [[m.homeId,m.home],[m.awayId,m.away]] as const) {
      const key = normalize(name), meta=teamMeta.get(id) ?? teamMetaByName.get(key);
      if (typeof meta?.short_name === "string" && meta.short_name.trim()) shortTeamNames[String(id)] = meta.short_name.trim();
      if (typeof meta?.team_name === "string" && meta.team_name.trim()) {
        fullTeamNames[name] = meta.team_name.trim();
        if (typeof meta?.short_name === "string" && meta.short_name.trim()) fullTeamNames[meta.short_name.trim()] = meta.team_name.trim();
      }
      if (typeof meta?.team_logo === "string" && meta.team_logo) logos[name]=meta.team_logo;
      if (typeof meta?.stadium_logo === "string" && meta.stadium_logo) stadiums[name]=meta.stadium_logo;
    }
    const teamLocations = availableTeams
      .filter(d => typeof d.ws_team_id === "number")
      .map(d => ({
        id: d.ws_team_id as number,
        name: typeof d.team_name === "string" && d.team_name.trim() ? d.team_name.trim() : (typeof d.ws_team_name === "string" && d.ws_team_name.trim() ? d.ws_team_name.trim() : (typeof d.fbre_team_name === "string" ? d.fbre_team_name.trim() : "Unknown team")),
        city: typeof d.city === "string" ? d.city.trim() : "",
        state: typeof d.state === "string" ? d.state.trim() : "",
        latitude: number(d.latitude),
        longitude: number(d.longitude),
        stadium: typeof d.stadium_name === "string" ? d.stadium_name.trim() : "",
        logo: typeof d.team_logo === "string" ? d.team_logo : ""
      }));
    const goalscorers: Record<string,Array<{teamId:number;playerName:string|null;minute:number|null;addedTime:number;subtype:string|null}>> = {};
    for (const row of goalRows) { const fixture=schedule.find(item=>item.game_id===row.game_id); const subtype=typeof row.event_subtype==="string"?row.event_subtype:null; const teamId=subtype==="own_goal"&&fixture?(row.team_id===fixture.home_team_id?fixture.away_team_id:fixture.home_team_id):row.team_id; const key=String(row.game_id); (goalscorers[key]??=[]).push({teamId,playerName:typeof row.player_name==="string"?row.player_name:null,minute:number(row.minute),addedTime:number(row.added_time)??0,subtype}); }
    const seasonTeamNames = new Map<string, Map<string, number>>();
    for (const match of historicalMatches) {
      if (!match.season) continue;
      const names = seasonTeamNames.get(match.season) ?? new Map<string, number>();
      names.set(normalize(match.home), match.homeId);
      names.set(normalize(match.away), match.awayId);
      seasonTeamNames.set(match.season, names);
    }
    const seasonConfigs: SeasonConfig[] = seasonConfigRows.flatMap((row: any) => {
      if (typeof row?.season !== "string" || !seasons.includes(row.season)) return [];
      const summary = row.summary && typeof row.summary === "object" ? row.summary : {};
      const names = seasonTeamNames.get(row.season) ?? new Map<string, number>();
      const resolveNames = (values: unknown) => (Array.isArray(values) ? values : [values])
        .filter((value): value is string => typeof value === "string")
        .map(value => names.get(normalize(value)))
        .filter((value): value is number => Number.isInteger(value));
      const classifications: SeasonOutcomeClassification[] = [];
      const source = Array.isArray(summary.outcomes) ? summary.outcomes : (Array.isArray(summary.classifications) ? summary.classifications : []);
      for (const item of source) {
        if (!item || typeof item.type !== "string") continue;
        const rawTeamIds = item.teamIds ?? item.team_ids ?? item.clubIds ?? item.club_ids ?? [];
        const teamIds = (Array.isArray(rawTeamIds) ? rawTeamIds : [rawTeamIds]).map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value));
        if (!teamIds.length) continue;
        const competitionId = typeof item.competitionId === "string" ? item.competitionId : (typeof item.competition_id === "string" ? item.competition_id : (item.type === "qualification" ? "europe" : "bundesliga"));
        const label = typeof item.label === "string" ? item.label : item.type === "qualification" ? "European qualification" : item.type;
        classifications.push({ type: item.type, competitionId, label, teamIds });
      }
      const championName = typeof summary.champion === "string" ? summary.champion : undefined;
      const championTeamId = Number(summary.championTeamId ?? summary.champion_team_id ?? summary.champion?.teamId ?? summary.champion?.team_id ?? summary.champion?.clubId ?? summary.champion?.club_id ?? summary.champion ?? row.champion_team_id ?? row.championTeamId);
      const resolvedChampionId = Number.isInteger(championTeamId) ? championTeamId : resolveNames(championName)[0];
      if (Number.isInteger(resolvedChampionId) && !classifications.some(item => item.type === "champion" && item.teamIds.includes(resolvedChampionId))) classifications.push({ type: "champion", competitionId: "bundesliga", label: "Champion", teamIds: [resolvedChampionId] });
      const qualifications = Array.isArray(summary.european_qualifications) ? summary.european_qualifications : (Array.isArray(summary.europeanQualifications) ? summary.europeanQualifications : []);
      for (const item of qualifications) {
        if (!item || typeof item.competition !== "string") continue;
        const teamIds = resolveNames(item.teams ?? item.team_names ?? item.teamIds ?? item.team_ids);
        if (teamIds.length) classifications.push({ type: "qualification", competitionId: normalize(item.competition), label: item.competition, teamIds });
      }
      const relegatedIds = resolveNames(summary.relegated ?? summary.relegated_teams ?? []).concat((Array.isArray(summary.relegatedTeamIds) ? summary.relegatedTeamIds : []).map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value)));
      if (relegatedIds.length) classifications.push({ type: "relegated", competitionId: "bundesliga", label: "Relegated", teamIds: [...new Set(relegatedIds)] });
      const rawRules = row.rules && typeof row.rules === "object" ? row.rules : row.points && typeof row.points === "object" ? row.points : {};
      const pointsForWin = Number(rawRules.pointsForWin ?? rawRules.points_for_win ?? rawRules.win);
      const pointsForDraw = Number(rawRules.pointsForDraw ?? rawRules.points_for_draw ?? rawRules.draw);
      const rawTiebreakers = row.standings_tiebreakers ?? row.standingsTiebreakers;
      const standingsTiebreakers = Array.isArray(rawTiebreakers) ? rawTiebreakers.filter((value: unknown): value is string => typeof value === "string") : undefined;
      const adjustmentTeamId = (item: any) => { const raw = item?.teamId ?? item?.team_id ?? item?.clubId ?? item?.club_id; const id = Number(raw); if (Number.isInteger(id)) return id; return resolveNames(item?.team ?? item?.team_name ?? item?.club ?? item?.club_name ?? item?.name)[0]; };
      const adjustmentEntries = (value: unknown) => Array.isArray(value) ? value : value && typeof value === "object" ? Object.entries(value as Record<string, unknown>).map(([team, detail]) => detail && typeof detail === "object" ? { ...(detail as object), teamId: (detail as any).teamId ?? team, team: (detail as any).team ?? team } : { teamId: team, team, points: detail }) : [];
      const rawPointAdjustments = row.points_adjustments ?? row.pointsAdjustments ?? [];
      const points_adjustments = adjustmentEntries(rawPointAdjustments).flatMap((item: any) => { const teamId = adjustmentTeamId(item); if (!Number.isInteger(teamId)) return []; const raw = item?.deduction ?? item?.amount ?? item?.points; const value = Number(raw); if (!Number.isFinite(value) || value === 0) return []; return [{ teamId, points: item?.deduction !== undefined || item?.amount !== undefined ? -Math.abs(value) : value > 0 ? -value : value, ...(typeof item?.reason === "string" ? { reason: item.reason } : {}) }]; });
      const rawRecordAdjustments = row.record_adjustments ?? row.recordAdjustments ?? [];
      const record_adjustments = adjustmentEntries(rawRecordAdjustments).flatMap((item: any) => { const teamId = adjustmentTeamId(item); if (!Number.isInteger(teamId)) return []; const type = String(item?.type ?? item?.action ?? item?.kind ?? "").trim(); if (!type) return []; return [{ teamId, type, ...(typeof item?.reason === "string" ? { reason: item.reason } : {}) }]; });
      const summaryOutcomes = classifications;
      return [{ season: row.season, competition: typeof row.competition === "string" ? row.competition : "Bundesliga", startYear: Number.isInteger(row.start_year) ? row.start_year : undefined, endYear: Number.isInteger(row.end_year) ? row.end_year : undefined, teamCount: Number.isInteger(row.team_count ?? row.teams) ? Number(row.team_count ?? row.teams) : undefined, matchdays: Number.isInteger(row.matchdays) ? Number(row.matchdays) : undefined, rules: { ...(Number.isFinite(pointsForWin) ? { pointsForWin } : {}), ...(Number.isFinite(pointsForDraw) ? { pointsForDraw } : {}) }, standingsTiebreakers, points_adjustments, record_adjustments, dataAvailability: row.data_availability ?? row.dataAvailability ?? row.data, summary: { verified: summary.verified === true, champion: championName, championTeamId: Number.isInteger(resolvedChampionId) ? resolvedChampionId : undefined, european_qualifications: qualifications, relegated: Array.isArray(summary.relegated) ? summary.relegated : undefined, outcomes: summaryOutcomes }, outcomes: summaryOutcomes }];
    });
    const historicalPositions = includeHistory ? buildHistoricalPositions(seasons, historicalMatches, seasonConfigs) : [];
    const selectedConfig = seasonConfigs.find(config => config.season === season);
    const selectedPointsForWin = selectedConfig?.rules?.pointsForWin ?? 3;
    const selectedPointsForDraw = selectedConfig?.rules?.pointsForDraw ?? 1;
    return NextResponse.json({seasons,season,matches,teams:standings(matches, "all", [], selectedPointsForWin, selectedConfig?.standingsTiebreakers, selectedPointsForDraw, selectedConfig),stats,historicalMatches,historicalPositions,logos,fullTeamNames,shortTeamNames,stadiums,teamLocations,seasonConfigs,goalscorers,fetchedAt:new Date().toISOString()},
      {headers:{"Cache-Control":"private, max-age=60, stale-while-revalidate=300"}});
  } catch (error) {
    console.error("Dashboard data unavailable:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({error:"The Bundesliga database is unavailable. Start the bundesliga-mongo container and check the app's MongoDB settings."},{status:503});
  }
}




