"use client";

import { useId, useState } from "react";
import { metricLabel, metricUnit, type ClubSeason, type SeasonMetric } from "@/lib/team-season-comparison";
import { relativeDeviation } from "@/lib/team-comparison-statistics";
import { ALL_TEAM_ANALYSIS_CATEGORIES, TEAM_ANALYSIS_METRICS, type TeamAnalysisCategory, type TeamAnalysisMetricKey } from "./team-analysis-metrics";

export type HistoricalSeason = {season:string;ongoing:boolean;club?:ClubSeason};
type AxisMetric = SeasonMetric | `against:${TeamAnalysisMetricKey}`;
const presets:Record<string,[AxisMetric,AxisMetric]|null> = {
  "Attacking output":["shots","goals"],"Finishing efficiency":["shots","goalConversion"],
  "Defensive output":["against:shots","against:goals"],"Possession and creation":["possession","keyPasses"],
  "Passing efficiency":["passes","passAccuracy"],"Attacking penetration":["finalThirdPasses","insideBoxShots"],
  "Directness":null,"Defensive activity":["tackles","interceptions"],
  "Overall performance":["goals","against:goals"],"Results and possession":["possession","pointsPerMatch"],
};
const baseMetric=(metric:AxisMetric):SeasonMetric=>metric.startsWith("against:")?metric.slice(8) as TeamAnalysisMetricKey:metric as SeasonMetric;
const metricRow=(item:HistoricalSeason|undefined,metric:AxisMetric)=>metric.startsWith("against:")
  ?item?.club?.against?.[baseMetric(metric) as TeamAnalysisMetricKey]:item?.club?.metrics[baseMetric(metric)];
const options=(category:TeamAnalysisCategory):AxisMetric[]=>[
  ...TEAM_ANALYSIS_METRICS[category].map(metric=>metric.key),
  ...(category==="attacking"?["pointsPerMatch" as const]:[]),
  ...TEAM_ANALYSIS_METRICS[category].map(metric=>`against:${metric.key}` as const),
];
const categoryFor=(metric:AxisMetric):TeamAnalysisCategory=>ALL_TEAM_ANALYSIS_CATEGORIES.find(category=>options(category).includes(metric))??"attacking";
const fmt=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value);
const percentage=(value:number|null)=>value===null?"—":`${value>0?"+":""}${fmt(value)}%`;
const short=(season:string)=>season.slice(2,4)+"/"+season.slice(-2);
const nextSeason=(a:string,b:string)=>Number(b.slice(0,4))===Number(a.slice(0,4))+1;

export default function SeasonEvolutionScatter({seasons,reference,t}: {
  seasons:HistoricalSeason[];reference:string;t:(key:string)=>string
}) {
  const arrow=useId();
  const [axes,setAxes]=useState<[AxisMetric,AxisMetric]>(["shots","goals"]);
  const [categories,setCategories]=useState<[TeamAnalysisCategory,TeamAnalysisCategory]>(["attacking","attacking"]);
  const [relative,setRelative]=useState(false);
  const [connect,setConnect]=useState(true);
  const [selected,setSelected]=useState<string>();
  const [hovered,setHovered]=useState<string>();
  const label=(key:AxisMetric)=>`${key.startsWith("against:")?"Against · ":""}${metricLabel(baseMetric(key),t)}`;
  const available=(keys:[AxisMetric,AxisMetric])=>seasons.some(item=>keys.every(key=>metricRow(item,key)?.value!=null));
  const value=(item:HistoricalSeason,key:AxisMetric)=>{
    const row=metricRow(item,key);
    return relative?relativeDeviation(row?.value,row?.average):row?.value??null;
  };
  const points=seasons.flatMap((item,index)=>{
    const x=value(item,axes[0]),y=value(item,axes[1]);
    return x===null||y===null?[]:[{item,index,x,y}];
  });
  const active=points.find(point=>point.item.season===(selected??reference))??points.at(-1);
  const domain=(axis:"x"|"y")=>{
    const data=points.map(point=>point[axis]);
    if(relative)data.push(0);
    if(!data.length)return [-1,1];
    const min=Math.min(...data),max=Math.max(...data),padding=(max-min)*.12||1;
    return [min-padding,max+padding];
  };
  const [xmin,xmax]=domain("x"),[ymin,ymax]=domain("y");
  const x=(v:number)=>70+vToFraction(v,xmin,xmax)*721;
  const y=(v:number)=>350-vToFraction(v,ymin,ymax)*305;
  const selectPreset=(name:string)=>{
    const preset=presets[name];
    if(!preset)return;
    setAxes(preset);
    setCategories(preset.map(categoryFor) as typeof categories);
  };
  const axisLabel=(key:AxisMetric)=>relative?`${label(key)} (% vs league)`:`${label(key)} (${metricUnit(baseMetric(key))})`;
  const segments=points.flatMap((point,index)=>{
    const previous=points[index-1];
    return previous&&nextSeason(previous.item.season,point.item.season)?[[previous,point] as const]:[];
  });
  return <section className="panel comparison-card historical-scatter">
    <header><h3>Historical Evolution Scatterplot</h3><p>Each point is a season. Arrows lead toward the more recent season.</p></header>
    <div className="comparison-inline-controls historical-scatter-controls">
      <label>Preset<select value={Object.entries(presets).find(([,pair])=>pair?.[0]===axes[0]&&pair[1]===axes[1])?.[0]??""}
        onChange={event=>selectPreset(event.target.value)}>
        <option value="" disabled>Custom axes</option>
        {Object.entries(presets).map(([name,pair])=><option key={name} disabled={!pair||!available(pair)}>{name}</option>)}</select></label>
      <label>Scatterplot scale<select aria-label="Scatterplot scale" value={relative?"relative":"actual"} onChange={event=>setRelative(event.target.value==="relative")}>
        <option value="actual">Actual values</option><option value="relative">League-relative</option></select></label>
      <label><input type="checkbox" checked={connect} onChange={event=>setConnect(event.target.checked)}/> Connect seasons</label>
      <button type="button" onClick={()=>{selectPreset("Attacking output");setRelative(false);setConnect(true);setSelected(undefined);setHovered(undefined);}}>Reset chart</button>
    </div>
    <div className="historical-axes">
      {(["X","Y"] as const).map((axis,index)=><fieldset key={axis}><legend>{axis} axis</legend>
        <label>Category<select value={categories[index]} aria-label={`${axis} axis category`} onChange={event=>{
          const category=event.target.value as TeamAnalysisCategory;
          setCategories(index?[categories[0],category]:[category,categories[1]]);
          setAxes(index?[axes[0],options(category)[0]]:[options(category)[0],axes[1]]);
        }}>{ALL_TEAM_ANALYSIS_CATEGORIES.map(category=><option key={category} value={category}>{t(`teamAnalysis.${category==="possession"?"possessionCategory":category}`)}</option>)}</select></label>
        <label>Statistic<select value={axes[index]} aria-label={`${axis} axis statistic`} onChange={event=>{
          const metric=event.target.value as AxisMetric;
          setAxes(index?[axes[0],metric]:[metric,axes[1]]);
        }}>{options(categories[index]).map(key=><option key={key} value={key}>{label(key)}</option>)}</select></label>
      </fieldset>)}
    </div>
    {points.length?<div className="historical-scatter-content">
      <figure className="historical-scatter-plot">
        <svg viewBox="0 0 820 412" role="group" aria-label="Historical season scatterplot">
          <defs><marker id={arrow} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="var(--muted)"/></marker></defs>
          {[0,.25,.5,.75,1].map(fraction=>{
            const xv=xmin+(xmax-xmin)*fraction,yv=ymin+(ymax-ymin)*fraction;
            return <g key={fraction} className="historical-chart-grid">
              <line x1={x(xv)} x2={x(xv)} y1={45} y2={350}/><line x1={70} x2={791} y1={y(yv)} y2={y(yv)}/>
              <text x={x(xv)} y={370} textAnchor="middle">{fmt(xv)}{relative?"%":""}</text>
              <text x={62} y={y(yv)+4} textAnchor="end">{fmt(yv)}{relative?"%":""}</text>
            </g>;
          })}
          {relative&&<g className="historical-chart-benchmark"><line x1={x(0)} x2={x(0)} y1={45} y2={350}/><line x1={70} x2={791} y1={y(0)} y2={y(0)}/></g>}
          <text x={432} y={401} textAnchor="middle">{axisLabel(axes[0])}</text>
          <text x={70} y={24}>{axisLabel(axes[1])}</text>
          {connect&&segments.map(([a,b])=><line key={b.item.season} className="historical-trajectory-edge"
            x1={x(a.x)} y1={y(a.y)} x2={(x(b.x)*.9+x(a.x)*.1)} y2={(y(b.y)*.9+y(a.y)*.1)} markerEnd={`url(#${arrow})`}/>)}
          {points.map((point,index)=>{
            const {item}=point;
            const current=active?.item.season===item.season, isReference=item.season===reference;
            const crowded=points.slice(0,index).some(previous=>Math.abs(x(previous.x)-x(point.x))<38&&Math.abs(y(previous.y)-y(point.y))<19);
            const detail=`${item.season.replace("-","/")} · ${label(axes[0])} ${relative?percentage(point.x):fmt(point.x)} · ${label(axes[1])} ${relative?percentage(point.y):fmt(point.y)}`;
            return <g key={item.season} tabIndex={0} role="button" aria-label={detail} aria-pressed={current}
              onPointerEnter={()=>setHovered(detail)} onPointerLeave={()=>setHovered(undefined)} onFocus={()=>setHovered(detail)} onBlur={()=>setHovered(undefined)}
              onClick={()=>setSelected(item.season)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelected(item.season);}}}>
              <circle cx={x(point.x)} cy={y(point.y)} r={current||isReference?7:4.5} className={isReference?"historical-point-reference":"historical-point"}
                opacity={current||isReference?1:.4+.5*(point.index+1)/seasons.length} strokeWidth={current?2.5:1}/>
              {(!crowded||current||isReference)&&<text x={x(point.x)} y={y(point.y)-11} textAnchor="middle">{short(item.season)}{isReference?"*":""}</text>}
              <title>{detail}</title>
            </g>;
          })}
        </svg>
        <figcaption aria-live="polite">{hovered??(points.some(point=>point.item.season===reference)?"* Reference season · Select a point for season details.":"Select a point for season details.")}</figcaption>
      </figure>
      {active&&<aside className="historical-point-details" aria-label="Selected season details">
        <h4>{active.item.season.replace("-","/")}</h4><p>{active.item.club?.team.played??0} completed matches{active.item.ongoing?" · Ongoing season":""}</p>
        {axes.map((key,index)=>{
          const row=metricRow(active.item,key);
          const previous=metricRow(seasons.find(item=>nextSeason(item.season,active.item.season)),key);
          const change=row?.value!=null&&previous?.value!=null?row.value-previous.value:null;
          return <div key={index}><strong>{label(key)}</strong><dl>
            <dt>Club value</dt><dd>{fmt(row?.value)}{metricUnit(baseMetric(key))==="%"?"%":""}</dd>
            <dt>League average</dt><dd>{fmt(row?.average)}{row?.average!=null&&metricUnit(baseMetric(key))==="%"?"%":""}</dd>
            <dt>League rank</dt><dd>{row?.rank==null?"—":`#${row.rank}/${row.population}`}</dd>
            <dt>Vs league</dt><dd>{percentage(relativeDeviation(row?.value,row?.average))}</dd>
            <dt>Vs previous season</dt><dd>{change===null?"—":`${change>0?"+":""}${fmt(change)}${metricUnit(baseMetric(key))==="%"?" pp":""}`}</dd>
          </dl></div>;
        })}
      </aside>}
    </div>:<p className="team-analysis-empty">No seasons have values for both axes under these filters.</p>}
  </section>;
}

function vToFraction(value:number,min:number,max:number){return (value-min)/(max-min);}
