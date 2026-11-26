import {historicalTrend} from "@/lib/historical-research";
import {percentageMetric,type EvolutionMetric} from "@/lib/season-evolution-values";
const formatSeason=(season:string)=>season.replace("-","/");
export default function HistoricalTrendCell({observations,metric,view,textOnly=false}:{observations:{season:string;value:number|null}[];metric:EvolutionMetric;view:"actual"|"rank"|"index";textOnly?:boolean}){
  const rank=view==="rank"||view==="actual"&&metric==="position";
  const kind=rank?"rank":view==="index"?"index":percentageMetric(metric)?"percent":"rate";
  const trend=historicalTrend(observations,kind),unit=kind==="rank"?"places":kind==="percent"?"pp":kind==="index"?"index points":"per-game units";
  const label=trend.slope===null?`Insufficient observations (${trend.points.length}); at least three eligible seasons required.`:`${trend.direction}. OLS slope ${trend.slope.toFixed(3)} ${unit} per season. ${trend.points.length} observations: ${formatSeason(trend.points[0].season)}–${formatSeason(trend.points.at(-1)!.season)}. Stable threshold ±${trend.threshold.toFixed(3)} ${unit}/season. Actual season-year spacing is used; direction is not a performance judgement.`;
  if(textOnly)return <span className="research-trend-cell" title={label} aria-label={label}>{trend.slope===null?"Insufficient":trend.direction}</span>;
  const years=trend.points.map(point=>Number(point.season.slice(0,4))),values=trend.points.map(point=>point.value);
  const xmin=Math.min(...years),xmax=Math.max(...years),ymin=Math.min(...values),ymax=Math.max(...values);
  return <span className="research-trend-cell" title={label} aria-label={label}>{trend.slope===null?<span>Insufficient</span>:<><svg viewBox="0 0 72 24" aria-hidden="true"><path d={trend.points.map((point,index)=>`${index?"L":"M"}${3+(Number(point.season.slice(0,4))-xmin)/(xmax-xmin||1)*66} ${ymax===ymin?12:21-(point.value-ymin)/(ymax-ymin)*18}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.25"/></svg><span>{trend.direction==="Increasing"?"↗":trend.direction==="Decreasing"?"↘":"→"} {trend.direction}</span></>}</span>;
}

