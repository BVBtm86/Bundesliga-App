"use client";
import {useState} from "react";
import type {SeasonScope} from "@/lib/team-season-comparison";
import type {Dashboard} from "@/lib/types";
import {historicalBenchmark} from "@/lib/historical-research";
import {distributionValue,zoneLabels,zonePercentages,SPATIAL_METHODOLOGY,type DistributionMode,type SpatialDistribution,type SpatialDistributionResponse} from "@/lib/spatial-distributions";
import SpatialDistributionPitch,{distributionStatus} from "./spatial-distribution-pitch";
import {useSpatialDistributions} from "./use-spatial-distributions";
import SeasonChart,{type ChartSeries} from "./historical-season-chart";
import HistoricalTrendCell from "./historical-trend-cell";

const percent=(value:number|null|undefined)=>value==null?"—":`${value.toFixed(2)}%`;
const difference=(a:number|null|undefined,b:number|null|undefined)=>a==null||b==null?"—":`${a-b>0?"+":""}${(a-b).toFixed(2)} pp`;
const short=(season:string)=>season.slice(2,4)+"/"+season.slice(-2);

export default function AggregatedSpatialWorkspace({data,kind,teams,teamId,referenceSeason,secondSeason,scope,mode,basis="perMatch"}:{data:Dashboard;kind:"teams"|"history";teams:[number,number];teamId?:number;referenceSeason:string;secondSeason?:string;scope:SeasonScope;mode:DistributionMode;basis?:"stage"|"perMatch"}){
 const seasons=[...new Set([...(data.teamAnalysisSeasons??data.seasons).filter(season=>season>="2009-2010"),referenceSeason,...(secondSeason?[secondSeason]:[])])].sort();
 const [side,setSide]=useState<"for"|"against">("for");
 const {venue,period,from,to}=scope;
 const seasonA=referenceSeason,seasonB=secondSeason??referenceSeason,activeSeason=referenceSeason;
 const [selection,setSelection]=useState({territory:0,channels:0}),zone=selection[mode];
 const query=new URLSearchParams({kind,seasons:(kind==="history"?seasons:[activeSeason]).join(","),teams:kind==="history"?String(teamId):teams.join(","),pair:kind==="history"?[seasonA,seasonB].join(","):[activeSeason,activeSeason].join(","),basis,venue,side,period,from:String(from),to:String(to),league:"0"});
 const result=useSpatialDistributions<SpatialDistributionResponse>("/api/spatial-distributions?"+query);
 const samples=result.value?.samples??[],pair=kind==="history"?[samples.find(sample=>sample.season===seasonA),samples.find(sample=>sample.season===seasonB)]:[samples.find(sample=>sample.team===teams[0]),samples.find(sample=>sample.team===teams[1])];
 const shares=pair.flatMap(sample=>sample&&(sample.status==="complete"||sample.status==="partial")?zonePercentages(sample.counts[mode])??[]:[]);
 const colourRange={min:Math.min(...shares,100),max:Math.max(...shares,0)};
 const ordered=[...samples].sort((a,b)=>a.season.localeCompare(b.season)),latest=ordered.at(-1)?.season??referenceSeason,labels=zoneLabels(mode);
 const observations=ordered.map(sample=>({season:sample.season,value:distributionValue(sample,mode,zone)})),benchmark=historicalBenchmark(observations,latest);
 const series:ChartSeries[]=[{name:labels[zone],color:"var(--accent)",points:ordered.map(sample=>({season:sample.season,value:distributionValue(sample,mode,zone),ongoing:sample.ongoing,reference:sample.season===latest,detail:`${sample.season.replace("-","/")} · ${labels[zone]} ${percent(distributionValue(sample,mode,zone))} · ${sample.counts[mode][zone]} qualifying events · ${sample.covered}/${sample.included} covered matches · ${"Event-normalised distribution"}`}))}];
 return <div className="aggregated-spatial-workspace">
  <div className="distribution-controls"><div className="comparison-inline-controls distribution-filter-row">
    <label>For / Against<select value={side} onChange={event=>setSide(event.target.value as typeof side)}><option value="for">For</option><option value="against">Against</option></select></label>
   </div></div>
  {result.error?<p role="alert">Spatial distributions could not be loaded. <button type="button" onClick={()=>{result.retry();}}>Retry</button></p>:!result.value?<p role="status" className="team-analysis-empty">Aggregating recorded spatial events…</p>:<>
   <div className="spatial-pitches spatial-pitches-pair distribution-pitches">{pair.map((sample,index)=><SpatialDistributionPitch key={index} sample={sample} mode={mode} side={side} comparisonSide={index===0?"a":"b"} colourRange={colourRange}/>)}</div>
   <div className="positional-colour-legend"><span>Lower share · {colourRange.min.toFixed(1)}%</span><i aria-hidden="true"/><span>Higher share · {colourRange.max.toFixed(1)}%</span></div>
   <p className="distribution-perspective">{result.value.perspective.replace("attacking-right","attacking-up").replace("attacking left to right","attacking bottom to top")} Display coordinates are rotated to match the other spatial views.</p>
   {kind==="history"&&<>
    <section className="panel comparison-card historical-matrix statistical-evolution-matrix spatial-historical-matrix historical-all-seasons-matrix"><header><h3>Historical Spatial Matrix</h3><p>Select a zone. Missing or partial event coverage is excluded from historical statistics.</p></header><div className="comparison-table-scroll" role="region" aria-label="Historical spatial matrix" tabIndex={0}><table className="evolution-table"><thead><tr><th>Zone</th>{[...ordered].reverse().map((sample,index)=><th key={sample.season} className={index===0?"historical-latest-column":undefined}>{short(sample.season)}{sample.ongoing?"*":""}</th>)}<th className="historical-trend-column">Trend</th><th className="historical-difference-column">Vs historical avg</th></tr></thead><tbody>{labels.map((label,index)=>{const observations=ordered.map(sample=>({season:sample.season,value:distributionValue(sample,mode,index)})),avg=historicalBenchmark(observations,latest),current=observations.find(row=>row.season===latest)?.value;return <tr key={label} data-active={zone===index} onClick={()=>setSelection(current=>({...current,[mode]:index}))}><th scope="row"><button type="button" className="historical-metric-selector" aria-pressed={zone===index} onClick={()=>setSelection(current=>({...current,[mode]:index}))}>{label}</button></th>{[...ordered].reverse().map((sample,column)=><td key={sample.season} className={column===0?"historical-latest-column":undefined} title={`${sample.covered}/${sample.included} covered matches · ${sample.counts[mode][index]} qualifying events · ${distributionStatus(sample)||"Complete sample"}`}>{percent(distributionValue(sample,mode,index))}</td>)}<td className="historical-trend-column"><HistoricalTrendCell observations={observations} metric="possession" view="actual" textOnly/></td><td className="historical-difference-column" title={`${avg.count} eligible historical seasons, excluding ${latest}`}>{difference(current,avg.value)}</td></tr>;})}</tbody></table></div></section>
    <div className="historical-research-charts spatial-historical-charts"><section className="panel comparison-card spatial-historical-line"><header><h3>Historical Evolution</h3><p>{labels[zone]} · {side==="for"?"For":"Against"}</p></header><SeasonChart key={`${mode}:${zone}:${basis}:${side}:${venue}:${period}`} title={`${labels[zone]} across seasons`} series={series} sharedScale wide research benchmark={{value:benchmark.value,label:"Historical avg"}} formatValue={percent}/></section></div>
   </>}
  </>}
  <details key={mode} className="spatial-view-insights"><summary>Insights</summary><p>{mode==="territory"?"Territorial distribution":"Attacking channel"} insights are not available yet.</p></details>
  <p className="distribution-methodology">{SPATIAL_METHODOLOGY} Territory uses passes, shots, dribbles and explicit touches. Attacking channels use completed passes, successful dribbles and shots. Missing coordinates are excluded. Both pitches share a relative green-to-red colour scale across the six displayed zones. Colours indicate event share, not performance.</p>
 </div>;
}
