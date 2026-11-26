import { completed, standings } from "./analytics";
import type { Dashboard, Match, MatchStats, Team } from "./types";
import { TEAM_ANALYSIS_METRICS, type TeamAnalysisMetricKey } from "../components/team-analysis-metrics";
import { isRatioMetric, metricValue, periodRow, ratioParts } from "../components/team-analysis-value";

export type SeasonScope = {from:number;to:number;venue:"all"|"home"|"away";period:"ft"|"fh"|"sh"};
export const fullScope: SeasonScope = {from:1,to:34,venue:"all",period:"ft"};
export const seasonMetrics = [...new Map(Object.values(TEAM_ANALYSIS_METRICS).flat().map(metric => [metric.key,metric])).values()];
export type SeasonMetric = TeamAnalysisMetricKey | "position" | "pointsPerMatch" | "conceded" | "opponentShots" | "progressivePasses" | "finalThirdEntries";
export type CoveredPassing = {matchId:number;teamId:number;period:SeasonScope["period"];usablePasses:number;rejectedPasses:number;progressive:number;entries:number};
export const overviewMetrics: SeasonMetric[] = ["position","pointsPerMatch","goals","conceded","possession","passes","passAccuracy","shots","onTarget","recoveries","interceptions"];
export const metricLabel = (key:SeasonMetric, t:(key:string)=>string) =>
  key==="position" ? "League position" : key==="pointsPerMatch" ? "Points" : key==="conceded" ? "Goals conceded" : key==="opponentShots" ? "Opponent shots" : key==="progressivePasses" ? "Progressive passes" : key==="finalThirdEntries" ? "Final-third entries" :
  t(seasonMetrics.find(metric => metric.key===key)?.labelKey ?? key);
export const metricUnit = (key:SeasonMetric) => key==="position" ? "rank" : key==="progressivePasses" ? "per 90" : key==="possession" || seasonMetrics.some(metric=>metric.key===key && metric.unit==="percent") ? "%" : "per match";
export const lowerIsRankedHigher = (key:SeasonMetric) => key==="position" || key==="conceded" || key==="opponentShots";

export type SeasonValue = {value:number|null;matches:number;rank:number|null;average:number|null;percentile:number|null;population:number};
export type ClubSeason = {team:Team;position:number|null;metrics:Partial<Record<SeasonMetric,SeasonValue>>;against?:Partial<Record<TeamAnalysisMetricKey,SeasonValue>>};
export type SeasonSummary = {season:string;ongoing:boolean;clubs:ClubSeason[]};

export function summarizeLeague(data:Pick<Dashboard,"season"|"matches"|"stats"|"seasonConfigs">, scope:SeasonScope, passing:CoveredPassing[] = [], includeAgainst=false): SeasonSummary {
  const all = completed(data.matches);
  const filtered = all.filter(match=>match.week>=scope.from && match.week<=scope.to);
  const config = data.seasonConfigs?.find(item=>item.season===data.season);
  const scopedTable = standings(filtered,scope.venue,data.matches,config?.rules?.pointsForWin ?? 3,config?.standingsTiebreakers,config?.rules?.pointsForDraw ?? 1,config);
  const rows = new Map<string,MatchStats>(data.stats.map(row=>[`${row.gameId}:${row.teamId}`,row]));
  const events=new Map(passing.filter(row=>row.period===scope.period).map(row=>[`${row.matchId}:${row.teamId}`,row]));
  const keys:SeasonMetric[] = [...seasonMetrics.map(metric=>metric.key),"position","pointsPerMatch","conceded","opponentShots","progressivePasses","finalThirdEntries"];
  const clubs:ClubSeason[] = scopedTable.map((team,index) => {
    const matches = filtered.filter(match => (scope.venue!=="away" && match.homeId===team.id) || (scope.venue!=="home" && match.awayId===team.id));
    const position = scope.period==="ft" && team.played && team.rankingStatus!=="playoff_required" && team.rankingStatus!=="tied" ? index+1 : null;
    const metrics:ClubSeason["metrics"] = {};
    const put = (key:SeasonMetric,value:number|null,matches:number) => {
      metrics[key] = {value,matches,rank:null,average:null,percentile:null,population:0};
    };
    put("position",position,scope.period==="ft"?team.played:0);
    put("pointsPerMatch",scope.period==="ft" && team.played ? team.points/team.played : null,scope.period==="ft"?team.played:0);
    for (const key of keys) {
      if (key==="position" || key==="pointsPerMatch") continue;
      let sum=0, denominator=0, covered=0;
      for (const match of matches) {
        const {row,opponent} = periodRow(rows,match,team.id,scope.period);
        const home = match.homeId===team.id;
        if (key==="progressivePasses" || key==="finalThirdEntries") {
          const event=events.get(`${match.id}:${team.id}`);
          if (!event || event.rejectedPasses || event.usablePasses!==row?.passes) continue;
          sum+=key==="progressivePasses"?event.progressive:event.entries;
          denominator+=key==="progressivePasses"&&scope.period!=="ft"?.5:1;
          covered++;
          continue;
        }
        if (key!=="conceded" && key!=="opponentShots" && isRatioMetric(key)) {
          const ratio = ratioParts(row,opponent,key);
          if (!ratio) continue;
          sum+=ratio.numerator; denominator+=ratio.denominator; covered++;
          continue;
        }
        const value = key==="goals" ? (scope.period==="ft" ? home?match.homeGoals:match.awayGoals : row?.goals) :
          key==="conceded" ? (scope.period==="ft" ? home?match.awayGoals:match.homeGoals : opponent?.goals) :
          key==="opponentShots" ? opponent?.shots : metricValue(match,row,opponent,key,false);
        if (typeof value!=="number" || !Number.isFinite(value)) continue;
        sum+=value; denominator++; covered++;
      }
      put(key,denominator ? sum/denominator*(key!=="conceded" && key!=="opponentShots" && key!=="progressivePasses" && key!=="finalThirdEntries" && isRatioMetric(key)?100:1):null,covered);
    }
    if(!includeAgainst)return {team,position,metrics};
    const against:ClubSeason["against"]={};
    for(const {key} of seasonMetrics){
      let sum=0,denominator=0,covered=0;
      for(const match of matches){
        const {row,opponent}=periodRow(rows,match,team.id,scope.period);
        if(isRatioMetric(key)){
          const pair=ratioParts(opponent,row,key);
          if(!pair||pair.denominator<=0)continue;
          sum+=pair.numerator;
          denominator+=pair.denominator;
        }else{
          const value=key==="goals"&&scope.period==="ft"?(match.homeId===team.id?match.awayGoals:match.homeGoals):
            key==="goals"?opponent?.goals:metricValue(match,opponent,row,key,true);
          if(typeof value!=="number"||!Number.isFinite(value))continue;
          sum+=value;
          denominator++;
        }
        covered++;
      }
      against[key]={value:denominator?sum/denominator*(isRatioMetric(key)?100:1):null,matches:covered,rank:null,average:null,percentile:null,population:0};
    }
    return {team,position,metrics,against};
  });
  const benchmark=(rows:(SeasonValue|undefined)[],lower:boolean,percentiles:boolean)=>{
    const eligible=rows.filter((metric):metric is SeasonValue&{value:number}=>metric?.value!=null);
    if(!eligible.length)return;
    const average=eligible.reduce((total,metric)=>total+metric.value,0)/eligible.length;
    for(const metric of eligible){
      const ahead=eligible.filter(other=>lower?other.value<metric.value:other.value>metric.value).length;
      const tied=eligible.filter(other=>other.value===metric.value).length;
      Object.assign(metric,{average,rank:ahead+1,population:eligible.length,
        percentile:percentiles?(eligible.length-ahead-tied/2)/eligible.length*100:null});
    }
  };
  for(const key of keys)benchmark(clubs.map(club=>club.metrics[key]),lowerIsRankedHigher(key),true);
  if(includeAgainst)for(const {key} of seasonMetrics){
    benchmark(clubs.map(club=>club.against?.[key]),!["yellowCards","foulsSuffered","saves","savePercentage"].includes(key),false);
  }
  const scheduled = data.matches.filter(match=>match.status!=="cancelled").length;
  return {season:data.season,ongoing:all.length<Math.max(scheduled,306),clubs};
}

export type {Match};

export const trajectoryMetrics = ["pointsPerMatch","conceded",...seasonMetrics.map(metric=>metric.key)] as const;
export type TrajectoryMetric = typeof trajectoryMetrics[number];
export type TrajectoryPoint = {date?:string;matchId:number; week:number; values:Record<TrajectoryMetric,number|null>; passing:{numerator:number;denominator:number}|null; againstValues?:Record<TrajectoryMetric,number|null>; againstRatios?:Partial<Record<TrajectoryMetric,{numerator:number;denominator:number}>>; ratios?:Partial<Record<TrajectoryMetric,{numerator:number;denominator:number}>>};

export function clubSeasonTrajectory(matches:Match[],stats:MatchStats[],scope:SeasonScope,team:number,win=3,draw=1,includeAgainst=false):TrajectoryPoint[] {
  const rows=new Map(stats.map(row=>[`${row.gameId}:${row.teamId}`,row]));
  return completed(matches).filter(match=>match.week>=scope.from&&match.week<=scope.to&&
    ((scope.venue!=="away"&&match.homeId===team)||(scope.venue!=="home"&&match.awayId===team)))
    .sort((a,b)=>a.week-b.week||a.date.localeCompare(b.date)||a.id-b.id).map(match=>{
      const {row,opponent}=periodRow(rows,match,team,scope.period);
      const home=match.homeId===team;
      const goals=home?match.homeGoals!:match.awayGoals!;
      const conceded=home?match.awayGoals!:match.homeGoals!;
      const ratios:NonNullable<TrajectoryPoint["ratios"]>={};
      const values=Object.fromEntries(trajectoryMetrics.map(key=>{
        if(key==="pointsPerMatch")return [key,scope.period==="ft"?(goals>conceded?win:goals===conceded?draw:0):null];
        if(key==="goals")return [key,scope.period==="ft"?goals:row?.goals??null];
        if(key==="conceded")return [key,scope.period==="ft"?conceded:opponent?.goals??null];
        if(isRatioMetric(key)){
          const parts=ratioParts(row,opponent,key);
          if(parts&&parts.denominator>=0)ratios[key]=parts;
          return [key,parts&&parts.denominator>0?100*parts.numerator/parts.denominator:null];
        }
        const value=metricValue(match,row,opponent,key,false);
        if(key==="possession"&&value!==null)ratios[key]={numerator:value,denominator:100};
        return [key,value];
      })) as TrajectoryPoint["values"];
      const againstRatios:NonNullable<TrajectoryPoint["ratios"]>={};
      const againstValues=includeAgainst?Object.fromEntries(trajectoryMetrics.map(key=>{
        if(key==="pointsPerMatch")return [key,scope.period==="ft"?(conceded>goals?win:conceded===goals?draw:0):null];
        if(key==="goals")return [key,scope.period==="ft"?conceded:opponent?.goals??null];
        if(key==="conceded")return [key,scope.period==="ft"?goals:row?.goals??null];
        if(isRatioMetric(key)){
          const parts=ratioParts(opponent,row,key);
          if(parts&&parts.denominator>=0)againstRatios[key]=parts;
          return [key,parts&&parts.denominator>0?100*parts.numerator/parts.denominator:null];
        }
        const value=metricValue(match,opponent,row,key,true);
        if(key==="possession"&&value!==null)againstRatios[key]={numerator:value,denominator:100};
        return [key,value];
      })) as TrajectoryPoint["values"]:undefined;
      return {date:match.date,matchId:match.id,week:match.week,passing:ratios.passAccuracy??null,ratios,values,...(includeAgainst?{againstValues,againstRatios}:{})};
    });
}
