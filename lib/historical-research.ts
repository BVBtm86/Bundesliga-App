import type { EvolutionMetric } from "./season-evolution-values";
export type SeasonObservation={season:string;value:number|null|undefined};
export type PairedObservation={x:number|null|undefined;y:number|null|undefined};
export const finiteValue=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);
export const mean=(values:(number|null|undefined)[])=>{
 const valid=values.filter(finiteValue);
 return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;
};
export function historicalBenchmark(observations:SeasonObservation[],latest:string){
 const eligible=observations.filter(row=>row.season<latest&&finiteValue(row.value));
 return {value:mean(eligible.map(row=>row.value)),count:eligible.length};
}
function ranks(values:number[]){
 const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);
 const result:number[]=[];
 for(let start=0;start<sorted.length;){
  let end=start+1;while(end<sorted.length&&sorted[end].value===sorted[start].value)end++;
  const rank=(start+1+end)/2;
  for(let index=start;index<end;index++)result[sorted[index].index]=rank;
  start=end;
 }
 return result;
}
function covariance(points:{x:number;y:number}[]){
 const xMean=mean(points.map(row=>row.x))??0,yMean=mean(points.map(row=>row.y))??0;
 const totals=points.reduce((sum,row)=>({xx:sum.xx+(row.x-xMean)**2,yy:sum.yy+(row.y-yMean)**2,xy:sum.xy+(row.x-xMean)*(row.y-yMean)}),{xx:0,yy:0,xy:0});
 return {...totals,xMean,yMean};
}
export function pairedStatistics(observations:PairedObservation[]){
 const points=observations.filter((row):row is {x:number;y:number}=>finiteValue(row.x)&&finiteValue(row.y));
 const {xx,yy,xy,xMean,yMean}=covariance(points);
 const slope=points.length>=2&&xx>0?xy/xx:null;
 const pearson=points.length>=2&&xx>0&&yy>0?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null;
 const xr=ranks(points.map(row=>row.x)),yr=ranks(points.map(row=>row.y));
 const ranked=covariance(xr.map((x,index)=>({x,y:yr[index]})));
 const spearman=points.length>=2&&ranked.xx>0&&ranked.yy>0?Math.max(-1,Math.min(1,ranked.xy/Math.sqrt(ranked.xx*ranked.yy))):null;
 return {count:points.length,slope,intercept:slope===null?null:yMean-slope*xMean,pearson,spearman};
}
export function historicalTrend(observations:SeasonObservation[],kind:"rank"|"percent"|"index"|"rate"){
 const points=observations.filter((row):row is {season:string;value:number}=>finiteValue(row.value)&&Number.isFinite(Number(row.season.slice(0,4)))).sort((a,b)=>a.season.localeCompare(b.season)).slice(-5);
 const result=pairedStatistics(points.map(row=>({x:Number(row.season.slice(0,4)),y:row.value})));
 const threshold=kind==="rank"?.1:kind==="percent"||kind==="index"?.5:Math.max(.02,(mean(points.map(row=>Math.abs(row.value)))??0)*.01);
 const slope=points.length>=3?result.slope:null;
 return {points,slope,threshold,direction:slope===null?"Insufficient":Math.abs(slope)<=threshold?"Stable":slope>0?"Increasing":"Decreasing"} as const;
}
/** Frequency metrics deliberately remain neutral; trend direction never implies performance. */
export function performanceDirection(metric:EvolutionMetric,against:boolean):"higher"|"lower"|null {
 if(metric==="position")return "lower";
 if(["pointsPerMatch","goals","goalDifference","shotAccuracy","goalConversion","passAccuracy","tackleSuccess","longPassAccuracy","crossCompletion","finalThirdCompletion","savePercentage"].includes(metric))return against?"lower":"higher";
 if(["conceded","ownGoals","errors","lossOfPossession","dispossessed","turnovers","yellowCards","secondYellowCards","redCards"].includes(metric))return against?"higher":"lower";
 return null;
}
