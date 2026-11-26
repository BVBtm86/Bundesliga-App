"use client";
import { useEffect, useMemo, useState } from "react";
import type { Dashboard, Match } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import type { ScatterFilters } from "./team-analysis-scatter";
import { TEAM_ANALYSIS_METRICS, type TeamAnalysisCategory, type TeamAnalysisMetricKey } from "./team-analysis-metrics";
import { metricValue } from "./team-analysis-value";
const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
type Point={week:number;forValue:number|null;againstValue:number|null;opponents:string[];fixtures:Match[]};
const trendSeries = [["forValue", "for"], ["againstValue", "against"]] as const;

function MatchdayLines({ points, setHovered, label, locale }: {
  points: Point[];
  setHovered: (week: number | null) => void;
  label: (point: Point) => string;
  locale: string;
}) {
  const values = points.flatMap(point => [point.forValue, point.againstValue]).filter(finite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = min === max ? Math.max(Math.abs(max) * .05, .5) : (max - min) * .1;
  const low = min >= 0 ? Math.max(0, min - padding) : min - padding;
  const high = max + padding;
  const interval = (high - low) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(interval));
  const step = ([1, 2, 2.5, 5, 10].find(multiplier => multiplier >= interval / magnitude) ?? 10) * magnitude;
  const firstTick = Math.floor(low / step);
  const lastTick = Math.ceil(high / step);
  const ticks = Array.from({ length: lastTick - firstTick + 1 }, (_, index) => (firstTick + index) * step);
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: Math.max(0, -Math.floor(Math.log10(step))) + (step / magnitude === 2.5 ? 1 : 0) });
  const position = (value: number) => (value - firstTick * step) / ((lastTick - firstTick) * step);
  const x = (index: number) => (index + .5) / points.length * 100;
  return <div className="team-analysis-trend-bars team-analysis-trend-lines">
    <aside className="team-analysis-trend-y-axis" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ bottom: `${position(tick) * 100}%` }}>{formatter.format(tick)}</span>)}</aside>
    <svg className="team-analysis-trend-line-overlay" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
      {ticks.map(tick => {
        const y = (1 - position(tick)) * 120;
        return <line key={tick} x1={0} x2={100} y1={y} y2={y} vectorEffect="non-scaling-stroke" />;
      })}
      {trendSeries.map(([key, side]) => {
        let path = "";
        let connected = false;
        points.forEach((point, index) => {
          const value = point[key];
          if (value === null) {
            connected = false;
            return;
          }
          path += `${connected ? "L" : "M"}${x(index)} ${(1 - position(value)) * 120} `;
          connected = true;
        });
        return <path key={key} className={side} d={path} fill="none" vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
    {points.map(point => <div key={point.week} className="team-analysis-trend-point" tabIndex={0}
      aria-label={label(point)} onPointerEnter={() => setHovered(point.week)} onPointerLeave={() => setHovered(null)}
      onFocus={() => setHovered(point.week)} onBlur={() => setHovered(null)} onClick={() => setHovered(point.week)}>
      {trendSeries.map(([key, side]) => point[key] === null ? null :
        <span key={key} className={`team-analysis-trend-marker ${side}`} style={{ bottom: `${position(point[key]) * 100}%` }} />)}
      <small>{point.week}</small>
    </div>)}
  </div>;
}

export default function TeamAnalysisSeasonTrend({data,teamId,filters,category}:{data:Dashboard;teamId:number;filters:ScatterFilters;category:TeamAnalysisCategory}){const {t,locale}=useI18n();const metrics=TEAM_ANALYSIS_METRICS[category];const [metricKey,setMetricKey]=useState<TeamAnalysisMetricKey>(metrics[0]?.key??"goals");const [selectedMode,setMode]=useState<"perMatch"|"cumulative"|"rolling">("perMatch");const [hovered,setHovered]=useState<number|null>(null);useEffect(()=>{if(!metrics.some(m=>m.key===metricKey))setMetricKey(metrics[0]?.key??"goals")},[category,metrics,metricKey]);const metric=metrics.find(m=>m.key===metricKey)??metrics[0];const isPercentage=metric.unit==="percent"||metric.key==="possession";const mode=isPercentage&&selectedMode==="cumulative"?"perMatch":selectedMode;const stats=new Map(data.stats.map(row=>[`${row.gameId}:${row.teamId}`,row]));const points=useMemo(()=>{if(!metric)return[];const matches=data.matches.filter(m=>m.finished&&Number.isInteger(m.homeGoals)&&Number.isInteger(m.awayGoals)&&m.week>=filters.from&&m.week<=Math.max(filters.from,filters.to)&&((m.homeId===teamId&&filters.venue!=="away")||(m.awayId===teamId&&filters.venue!=="home")));const raw=(m:Match,against:boolean)=>{const home=m.homeId===teamId,source=against?(home?m.awayId:m.homeId):teamId,row=stats.get(`${m.id}:${source}`)?.periods?.[filters.period],opponent=stats.get(`${m.id}:${home?m.awayId:m.homeId}`)?.periods?.[filters.period];if(metric.key==="goals")return filters.period==="ft"?(against?(home?m.awayGoals:m.homeGoals):(home?m.homeGoals:m.awayGoals)):finite(row?.goals)?row!.goals:null;return metricValue(m,row,opponent,metric.key,against)};const grouped=new Map<number,{for:number[];against:number[];opponents:string[];fixtures:Match[]}>();matches.sort((a,b)=>a.week-b.week||a.date.localeCompare(b.date)).forEach(m=>{const g=grouped.get(m.week)??{for:[],against:[],opponents:[],fixtures:[]};const f=raw(m,false),a=raw(m,true);if(f!==null)g.for.push(f);if(a!==null)g.against.push(a);g.opponents.push(m.homeId===teamId?m.away:m.home);g.fixtures.push(m);grouped.set(m.week,g)});let cf=0,ca=0;const base=[...grouped.entries()].map(([week,g])=>{const f=g.for.length?g.for.reduce((a,b)=>a+b,0)/g.for.length:null,a=g.against.length?g.against.reduce((x,y)=>x+y,0)/g.against.length:null;if(mode==="cumulative"){if(f!==null)cf+=f;if(a!==null)ca+=a;return{week,forValue:cf,againstValue:ca,opponents:g.opponents,fixtures:g.fixtures}}return{week,forValue:f,againstValue:a,opponents:g.opponents,fixtures:g.fixtures}});return mode==="rolling"?base.map((p,i)=>{const w=base.slice(Math.max(0,i-4),i+1),f=w.map(x=>x.forValue).filter((v):v is number=>v!==null),a=w.map(x=>x.againstValue).filter((v):v is number=>v!==null);return{...p,forValue:f.length?f.reduce((x,y)=>x+y,0)/f.length:null,againstValue:a.length?a.reduce((x,y)=>x+y,0)/a.length:null}}):base},[data.matches,teamId,filters,metric,stats,mode]);const hasData=points.some(p=>p.forValue!==null||p.againstValue!==null);const max=Math.max(1,...points.flatMap(p=>[p.forValue??0,p.againstValue??0]));const ticks=[1,.75,.5,.25,0].map(v=>max*v);const hoveredPoint=points.find(p=>p.week===hovered);const format=(v:number|null)=>v===null?"—":isPercentage?`${v.toFixed(1)}%`:v.toFixed(2);const result=(m:Match)=>{const home=m.homeId===teamId,own=home?m.homeGoals!:m.awayGoals!,opp=home?m.awayGoals!:m.homeGoals!;return own>opp?t("teamAnalysis.win"):own<opp?t("teamAnalysis.loss"):t("teamAnalysis.draw")};return <section className="panel team-analysis-trend"><div className="panel-heading"><div><span className="eyebrow">{t("teamAnalysis.performanceTrend")}</span><h2>{t("teamAnalysis.performanceTrend")}</h2></div><div className="team-analysis-trend-controls"><label><span>{t("teamAnalysis.metric")}</span><select value={metricKey} onChange={e=>setMetricKey(e.target.value as TeamAnalysisMetricKey)}>{metrics.map(m=><option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}</select></label><label><span>{t("teamAnalysis.trendMode")}</span><select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="perMatch">{t("teamAnalysis.perMatch")}</option>{!isPercentage&&<option value="cumulative">{t("teamAnalysis.cumulative")}</option>}<option value="rolling">{t("teamAnalysis.rollingAverage")}</option></select></label></div></div>{points.length&&hasData?<><div className="team-analysis-trend-y-title">{t(metric.labelKey)}{isPercentage?" (%)":""}</div>{mode !== "rolling" && <><div className="team-analysis-trend-y-axis">{ticks.map((tick)=><span key={tick}>{isPercentage?tick.toFixed(0):tick.toFixed(1)}</span>)}</div><div className="team-analysis-trend-gridlines">{ticks.map((tick)=><i key={`grid-${tick}`} style={{bottom:`${(tick/max)*100}%`}}/>)}</div></>}{mode === "rolling" ? <MatchdayLines points={points} locale={locale} setHovered={setHovered} label={point =>
      `${t("dash.matchdayLabel", {number:point.week})} · ${t("teamAnalysis.for")} ${format(point.forValue)} · ${t("teamAnalysis.against")} ${format(point.againstValue)}`
    }/> : <div className="team-analysis-trend-bars">{points.map(p=><div key={p.week} className="team-analysis-trend-point" onMouseEnter={()=>setHovered(p.week)} onMouseLeave={()=>setHovered(null)}><span className={`for ${p.forValue===null?"missing":""}`} style={{height:p.forValue===null?"0px":`${Math.max(8,(p.forValue/max)*120)}px`}}/><span className={`against ${p.againstValue===null?"missing":""}`} style={{height:p.againstValue===null?"0px":`${Math.max(8,(p.againstValue/max)*120)}px`}}/><small>{p.week}</small></div>)}</div>}{hoveredPoint&&<div className="team-analysis-trend-tooltip"><strong>{t("dash.matchdayLabel",{number:hoveredPoint.week})}</strong>{hoveredPoint.fixtures.map(m=><div key={m.id}><b>{m.home} vs {m.away}</b><span>{t(metric.labelKey)} · {t("teamAnalysis.for")}: {format(hoveredPoint.forValue)}</span><span>{t(metric.labelKey)} · {t("teamAnalysis.against")}: {format(hoveredPoint.againstValue)}</span><span>{t("teamAnalysis.result")}: {m.homeGoals}–{m.awayGoals} ({result(m)})</span></div>)}</div>}<div className="team-analysis-trend-x-title">{t("teamAnalysis.matchday")}</div>
    {mode === "rolling" && <div className="team-analysis-trend-line-legend">
      <span><i className="for" />{t("teamAnalysis.for")}</span><span><i className="against" />{t("teamAnalysis.against")}</span>
    </div>}</>:<div className="team-analysis-empty"><p>{points.length?t("teamAnalysis.noMetricData"):t("teamAnalysis.noMatches")}</p></div>}</section>}
