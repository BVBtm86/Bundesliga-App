import { completed } from "./analytics";
import type { Match } from "./types";

/** Standings at the instant this club completed its Nth game (postponements included). */
export function overviewStageMatches(matches:Match[],team:number,count:number):Match[] {
  const timestamp=(match:Match)=>Date.parse(match.date);
  const ordered=completed(matches).sort((a,b)=>{
    const first=timestamp(a),second=timestamp(b);
    return (Number.isFinite(first)&&Number.isFinite(second)?first-second:a.week-b.week)||a.id-b.id;
  });
  const club=ordered.filter(match=>match.homeId===team||match.awayId===team);
  const cutoff=club[count-1];
  if(!cutoff)return matches.map(match=>({...match,finished:false}));
  const included=new Set(ordered.slice(0,ordered.indexOf(cutoff)+1).map(match=>match.id));
  return matches.map(match=>included.has(match.id)?match:{...match,finished:false});
}
