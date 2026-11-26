import type { TrajectoryMetric, TrajectoryPoint } from "./team-season-comparison";
import { isRatioMetric } from "../components/team-analysis-value";

export type EvolutionMetric=TrajectoryMetric|"position"|"goalDifference";
export type EvolutionProgressMode="match"|"total"|"running"|"rolling";
export const percentageMetric=(key:EvolutionMetric)=>key==="possession"||(key!=="pointsPerMatch"&&key!=="conceded"&&key!=="position"&&key!=="goalDifference"&&isRatioMetric(key));

export function evolutionProgressValues(points:TrajectoryPoint[],metric:EvolutionMetric,mode:EvolutionProgressMode,against=false):Map<number,number|null> {
  const values=new Map<number,number|null>();
  const read=(point:TrajectoryPoint)=>{
    const source=against?point.againstValues:point.values;
    if(!source)return null;
    if(metric==="position")return null;
    if(metric==="goalDifference")return source.goals!=null&&source.conceded!=null?source.goals-source.conceded:null;
    return source[metric]??null;
  };
  const ordered=[...points].sort((a,b)=>(Date.parse(a.date??"")-Date.parse(b.date??"")||a.week-b.week||a.matchId-b.matchId));
  ordered.forEach((point,index)=>{
    if(mode==="match"){values.set(point.week,read(point));return;}
    const window=ordered.slice(mode==="rolling"?Math.max(0,index-4):0,index+1);
    if(mode==="rolling"&&window.length<5){values.set(point.week,null);return;}
    if(percentageMetric(metric)){
      const pairs=window.map(point=>(against?point.againstRatios:point.ratios)?.[metric as TrajectoryMetric]);
      if(pairs.some(pair=>!pair)){values.set(point.week,null);return;}
      const denominator=pairs.reduce((sum,pair)=>sum+pair!.denominator,0);
      values.set(point.week,denominator>0?100*pairs.reduce((sum,pair)=>sum+pair!.numerator,0)/denominator:null);
    }else{
      const sample=window.map(read);
      values.set(point.week,sample.every((value):value is number=>value!==null)?sample.reduce((sum,value)=>sum+value,0)/(mode==="total"?1:sample.length):null);
    }
  });
  return values;
}
