import { NextResponse } from "next/server";
import { TACTICAL_PASSING_VERSION, type EventPassingSummary } from "@/lib/tactical-passing";
import { TACTICAL_DNA_VERSION } from "@/lib/tactical-dna";
import { overviewStageMatches } from "@/lib/season-overview-stage";
import { completed, standings } from "@/lib/analytics";
import { recordedFormations, type FormationRow } from "@/lib/season-spatial-lineup";
import { database } from "@/lib/mongo";
import { importedTeamStatsProjection, normalizeImportedTeamStats, type ImportedTeamStats } from "@/lib/imported-team-statistics";
import { clubSeasonTrajectory, fullScope, summarizeLeague, type Match, type SeasonScope, type SeasonSummary, type TrajectoryPoint } from "@/lib/team-season-comparison";

export const dynamic = "force-dynamic";
const cache = new Map<string,{until:number;data:SeasonSummary;trajectory?:TrajectoryPoint[]; history?:SeasonHistory}>();

type SeasonHistory = {position:number|null; ranks:{week:number;position:number|null}[]; formations:ReturnType<typeof recordedFormations>["distribution"]; recorded:number;longPassShare?:number|null};

export async function GET(request:Request) {
  const params = new URL(request.url).searchParams;
  const team = params.has("team") ? Number(params.get("team")) : undefined;
  const stage=params.has("stage")?Number(params.get("stage")):undefined;
  const against=params.get("against")==="1";
  const style=params.get("style")==="1";
  const historyRequested=params.get("history")==="1";
  const trajectoryTeam = params.get("trajectory")==="1"?team:undefined;
  const seasons = [...new Set((params.get("seasons")??"").split(","))].sort();
  const scope = {
    from:Number(params.get("from")??fullScope.from), to:Number(params.get("to")??fullScope.to),
    venue:params.get("venue")??fullScope.venue, period:params.get("period")??fullScope.period
  } as SeasonScope;
  if ((stage!==undefined&&(!Number.isSafeInteger(stage)||stage<0||stage>34||team===undefined)) || (team!==undefined&&(!Number.isSafeInteger(team)||team<=0)) || seasons.length>30 || seasons.some(season=>!/^\d{4}-\d{4}$/.test(season) || season<"2009-2010" || +season.slice(5)!==+season.slice(0,4)+1) ||
      ![scope.from,scope.to].every(Number.isSafeInteger) || scope.from<1 || scope.to<scope.from || scope.to>34 ||
      !["all","home","away"].includes(scope.venue) || !["ft","fh","sh"].includes(scope.period))
    return NextResponse.json({error:"Invalid Bundesliga season or filters."},{status:400});
  try {
    const db=await database();
    const load = async (season:string) => {
      const key=JSON.stringify([season,scope,trajectoryTeam,against,historyRequested||stage!==undefined?team:undefined,style,stage]);
      const hit=cache.get(key);
      if(hit && hit.until>Date.now()) return hit;
      const fixtures=await db.collection("game_schedule").find({season,competition_name:"Bundesliga",competition_country:"Germany"},{
        projection:{_id:0,game_id:1,week:1,game_date:1,home_team_id:1,away_team_id:1,home_team_name:1,away_team_name:1,home_goals:1,away_goals:1,game_status:1}
      }).toArray();
      const matches:Match[]=[...new Map(fixtures.filter(row=>Number.isSafeInteger(row.game_id)).map(row=>{
        const match:Match={id:row.game_id,season,week:row.week,date:String(row.game_date??""),homeId:row.home_team_id,awayId:row.away_team_id,
          home:row.home_team_name,away:row.away_team_name,homeGoals:Number.isInteger(row.home_goals)?row.home_goals:null,
          awayGoals:Number.isInteger(row.away_goals)?row.away_goals:null,finished:row.game_status==="finished",
          status:row.game_status==="cancelled"?"cancelled":undefined,venue:"",attendance:null};
        return [match.id,match] as const;
      })).values()];
      const [rows,rawConfig,derived] = await Promise.all([
        db.collection<ImportedTeamStats>("game_team_stats_app").find({game_id:{$in:matches.filter(match=>match.finished && match.week>=scope.from && match.week<=scope.to).map(match=>match.id)}},
          {projection:importedTeamStatsProjection([scope.period])}).toArray(),
        db.collection("season_config").findOne({season}),
        (trajectoryTeam!==undefined||historyRequested&&!style)?Promise.resolve([]):db.collection<{matchId:number;records:{teamId:number;period:SeasonScope["period"];passing?:EventPassingSummary}[]}>("game_tactical_dna_app")
          .find({season,version:TACTICAL_DNA_VERSION,passingVersion:TACTICAL_PASSING_VERSION,matchday:{$gte:scope.from,$lte:scope.to}},
            {projection:{_id:0,matchId:1,"records.teamId":1,"records.period":1,"records.passing.usablePasses":1,"records.passing.rejectedPasses":1,"records.passing.finalThirdEntries":1,"records.passing.progressive.attempts":1}}).toArray()
      ]);
      const rules=rawConfig?.rules??rawConfig?.points;
      const stats=rows.map(normalizeImportedTeamStats);
      const stageMatches=stage===undefined?matches:overviewStageMatches(matches,team!,stage);
      const data=summarizeLeague({season,matches:stageMatches,stats,seasonConfigs: rawConfig ? [{
        season,competition:"Bundesliga",standingsTiebreakers:rawConfig.standings_tiebreakers??rawConfig.standingsTiebreakers,
        rules:{pointsForWin:rules?.pointsForWin??rules?.points_for_win??rules?.win,pointsForDraw:rules?.pointsForDraw??rules?.points_for_draw??rules?.draw}
      }]:[]},scope,derived.flatMap(fixture=>fixture.records.flatMap(row=>row.period===scope.period&&row.passing?[{
          matchId:fixture.matchId,teamId:row.teamId,period:row.period,usablePasses:row.passing.usablePasses,rejectedPasses:row.passing.rejectedPasses,
          progressive:row.passing.progressive.attempts,entries:row.passing.finalThirdEntries
        }]:[])),against||trajectoryTeam!==undefined);
      data.ongoing=completed(matches).length<Math.max(306,matches.filter(match=>match.status!=="cancelled").length);
      let history:SeasonHistory|undefined;
      if(historyRequested&&team!==undefined){
        const played=completed(matches);
        const win=rules?.pointsForWin??rules?.points_for_win??rules?.win??3;
        const draw=rules?.pointsForDraw??rules?.points_for_draw??rules?.draw??1;
        const tiebreakers=rawConfig?.standings_tiebreakers??rawConfig?.standingsTiebreakers;
        const ranking=(window:Match[])=>{
          const table=standings(window,"all",matches,win,tiebreakers,draw);
          const index=table.findIndex(row=>row.id===team&&row.played>0&&row.rankingStatus!=="tied"&&row.rankingStatus!=="playoff_required");
          return index<0?null:index+1;
        };
        const clubMatches=played.filter(match=>match.week>=scope.from&&match.week<=scope.to&&
          ((scope.venue!=="away"&&match.homeId===team)||(scope.venue!=="home"&&match.awayId===team)));
        const formationRows=style?await db.collection<FormationRow>("game_formations").find(
          {team_id:team,game_id:{$in:clubMatches.map(match=>match.id)}},
          {projection:{_id:0,game_id:1,formation:1,positions:1}}).toArray():[];
        let longPassShare:number|null=null;
        if(style){
          const matchIds=new Set(clubMatches.map(match=>match.id));
          const totals=stats.reduce((total,row)=>{
            if(row.teamId!==team||!matchIds.has(row.gameId))return total;
            const period=row.periods?.[scope.period];
            const attempts=period?.passes,long=period?.longPasses;
            if(typeof attempts==="number"&&typeof long==="number"&&attempts>0&&long>=0&&long<=attempts){
              total.attempts+=attempts;
              total.long+=long;
            }
            return total;
          },{attempts:0,long:0});
          longPassShare=totals.attempts?100*totals.long/totals.attempts:null;
        }
        const {formations,distribution}=recordedFormations(formationRows);
        history={position:ranking(played),ranks:trajectoryTeam===undefined?[]:[...new Set(played.map(match=>match.week))].sort((a,b)=>a-b).map(week=>({
          week,position:ranking(played.filter(match=>match.week<=week))
        })),formations:distribution,recorded:formations.length,longPassShare};
      }
      if (cache.size>=100) cache.delete(cache.keys().next().value!);
      const entry={data,history,until:Date.now()+60000,trajectory:trajectoryTeam===undefined?undefined:
        clubSeasonTrajectory(matches,stats,scope,trajectoryTeam,rules?.pointsForWin??rules?.points_for_win??rules?.win,
          rules?.pointsForDraw??rules?.points_for_draw??rules?.draw,against)};
      cache.set(key,entry);
      return entry;
    };
    const loaded:Awaited<ReturnType<typeof load>>[]=[];
    for(let start=0;start<seasons.length;start+=3) loaded.push(...await Promise.all(seasons.slice(start,start+3).map(load)));
    const summaries=loaded.map(entry=>entry.data);
    const trajectories=trajectoryTeam===undefined?undefined:Object.fromEntries(loaded.map(entry=>[entry.data.season,entry.trajectory??[]]));
    const history=historyRequested?Object.fromEntries(loaded.map(entry=>[entry.data.season,entry.history])):undefined;
    return NextResponse.json({trajectories,history,summaries:team===undefined?summaries:summaries.map(summary=>({...summary,clubs:summary.clubs.filter(club=>club.team.id===team)}))});
  } catch (error) {
    console.error("Team season summaries unavailable",error instanceof Error?error.name:"Unknown error");
    return NextResponse.json({error:"Season statistics are temporarily unavailable."},{status:503});
  }
}
