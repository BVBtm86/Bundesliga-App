import type { Match, MatchPeriod, MatchStats, PeriodStats, SeasonPart, VenueFilter } from "./types";

export const PERIODS: {value:MatchPeriod;label:string}[] = [
  {value:"ft",label:"Full match"},{value:"fh",label:"First half"},{value:"sh",label:"Second half"},
  {value:"m_1_15",label:"1–15 min"},{value:"m_16_30",label:"16–30 min"},{value:"m_31_45",label:"31–45 min"},
  {value:"m_46_60",label:"46–60 min"},{value:"m_61_75",label:"61–75 min"},{value:"m_76_90",label:"76–90 min"},
  {value:"m_1_30",label:"1–30 min"},{value:"m_31_60",label:"31–60 min"},{value:"m_61_90",label:"61–90 min"}
];
export const periodLabel = (period:MatchPeriod) => PERIODS.find(p=>p.value===period)!.label;
export const seasonPartLabel = (part:SeasonPart) => part==="first"?"First half of season":part==="second"?"Second half of season":"Full season";
export const venueLabel = (venue:VenueFilter) => venue==="home"?"Home":venue==="away"?"Away":"All venues";

export function seasonSubset(matches:Match[],part:SeasonPart,maxMatchday?:number) {
  if (part === "all") return matches;
  const lastMatchday = maxMatchday ?? Math.max(34, ...matches.map(match => match.week));
  const split = Math.ceil(lastMatchday / 2);
  return matches.filter(m=>part==="first"?m.week>=1&&m.week<=split:m.week>split&&m.week<=lastMatchday);
}
export function statsForPeriod(row:MatchStats|undefined,period:MatchPeriod):PeriodStats|null {
  if (!row) return null;
  if (row.periods?.[period]) return row.periods[period]!;
  if (period!=="ft") return null;
  return {goals:null,shots:row.shots,onTarget:row.onTarget,possession:row.possession,passes:row.passes,passCompletion:row.passCompletion};
}
export function scoresForPeriod(matches:Match[],stats:MatchStats[],period:MatchPeriod):Match[] {
  if (period==="ft") return matches;
  const lookup=new Map(stats.map(row=>[row.gameId+":"+row.teamId,row]));
  const score=(gameId:number,teamId:number)=>{
    const value=statsForPeriod(lookup.get(gameId+":"+teamId),period)?.goals;
    return typeof value==="number"&&Number.isInteger(value)&&value>=0?value:null;
  };
  return matches.map(m=>({...m,homeGoals:score(m.id,m.homeId),awayGoals:score(m.id,m.awayId)}));
}
export function teamVenueMatches(matches:Match[],teamId:number,venue:VenueFilter) {
  return matches.filter(m=>venue==="home"?m.homeId===teamId:venue==="away"?m.awayId===teamId:m.homeId===teamId||m.awayId===teamId);
}

export type FixtureMode = "upcoming" | "results";
export function fixturesForMode(matches:Match[],mode:FixtureMode):Match[] {
  return matches.filter(m=>mode==="results"?m.finished:!m.finished).sort((a,b)=>{
    if(!a.date)return b.date?1:0;
    if(!b.date)return -1;
    return mode==="upcoming"?a.date.localeCompare(b.date)||a.id-b.id:b.date.localeCompare(a.date)||b.id-a.id;
  });
}
export function defaultMatchday(matches:Match[],mode:FixtureMode):number|null {
  return fixturesForMode(matches,mode).find(m=>m.week>0)?.week??null;
}
