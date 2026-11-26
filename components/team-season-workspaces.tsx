"use client";

import {usePathname} from "next/navigation";
import { Activity, useEffect, useId, useRef, useState } from "react";
import { ArrowLeftRight, CalendarDays, ChartNoAxesColumnIncreasing, Flag, Hand, Map as MapIcon, Shield, Swords, Target, TrendingUp, Network } from "lucide-react";
import AnalyticalSectionNavigation, { TacticalAnalysisPlaceholder, type AnalyticalSection } from "./analytical-section-navigation";
import { leagueIndex, relativeDeviation, symmetricDeviationLimit } from "@/lib/team-comparison-statistics";
import { historicalBenchmark, performanceDirection } from "@/lib/historical-research";
import SeasonSpatialWorkspace from "./season-spatial-workspace";
import HistoricalTrendCell from "./historical-trend-cell";
import HistoricalEvolutionModal from "./historical-evolution-modal";
import SeasonChart,{type ChartSeries} from "./historical-season-chart";
import HistoricalSeasonComparison from "./historical-season-comparison";
import { completed } from "@/lib/analytics";
import { evolutionProgressValues, percentageMetric, type EvolutionMetric, type EvolutionProgressMode } from "@/lib/season-evolution-values";
import { useI18n } from "@/lib/i18n";
import type { Dashboard } from "@/lib/types";
import {
  fullScope, lowerIsRankedHigher, metricLabel, metricUnit,
  type ClubSeason, type SeasonMetric, type SeasonScope, type SeasonSummary, type SeasonValue, type TrajectoryPoint, type TrajectoryMetric
} from "@/lib/team-season-comparison";
import { ALL_TEAM_ANALYSIS_CATEGORIES, TEAM_ANALYSIS_METRICS, type TeamAnalysisCategory } from "./team-analysis-metrics";
import TeamAnalysisScatter from "./team-analysis-scatter";
import InsightsPlaceholder from "./insights-placeholder";
import type {HistoricalSeason} from "./season-evolution-scatter";
import TeamSpatialComparison from "./team-spatial-comparison";
import SeasonEvolutionOverview, {type OverviewBasis} from "./season-evolution-overview";

const comparisonCategoryIcons = {
  attacking:Target, defending:Shield, passing:ArrowLeftRight,
  possession:Swords, discipline:Flag, goalkeeping:Hand
} satisfies Record<TeamAnalysisCategory,typeof Target>;

const formatNumber = (value:number|null|undefined) => value==null?"—":new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value);
const formatSeason = (value:string) => value.replace("-","/");
const shortSeason = (value:string) => value.slice(0,4)+"/"+value.slice(-2);
const valueText = (key:SeasonMetric, value:number|null|undefined) => formatNumber(value)+(value!=null && metricUnit(key)==="%"?"%":"");
const signed = (value:number|null,unit:string) => value===null?"—":`${value>0?"+":""}${formatNumber(value)}${unit==="%"?" pp":""}`;

function useJson<T>(url:string) {
  const [result,setResult]=useState<{url:string;value?:T;failed?:boolean}>();
  const [revision,retry]=useState(0);
  useEffect(()=>{
    if(!url) return;
    const controller=new AbortController();
    fetch(url,{signal:controller.signal}).then(async response=>{
      if(!response.ok) throw Error("Request failed");
      const value=await response.json() as T;
      if(!controller.signal.aborted)setResult({url,value});
    }).catch(()=>{if(!controller.signal.aborted)setResult({url,failed:true});});
    return ()=>controller.abort();
  },[url,revision]);
  return {result:result?.url===url?result:undefined,retry:()=>{setResult(undefined);retry(value=>value+1);}};
}

type SeasonHistory={position:number|null;ranks:{week:number;position:number|null}[];formations:{formation:string;count:number}[];recorded:number;longPassShare?:number|null};
function useSummaries(seasons:string[],scope:SeasonScope,team?:number,trajectory=false,against=false,history=false,style=false,stage?:number) {
  return useJson<{summaries:SeasonSummary[];trajectories?:Record<string,TrajectoryPoint[]>;history?:Record<string,SeasonHistory> }>(seasons.length?"/api/team-season?"+new URLSearchParams({
    seasons:[...new Set(seasons)].sort().join(","),from:String(scope.from),to:String(scope.to),venue:scope.venue,period:scope.period,...(team===undefined?{}:{team:String(team)}),...(trajectory?{trajectory:"1"}:{}),...(history?{history:"1"}:{}),...(against?{against:"1"}:{}),...(style?{style:"1"}:{}),...(stage===undefined?{}:{stage:String(stage)})
  }):"");
}
function LoadState({error,retry}: {error?:boolean;retry:()=>void}) {
  return error ? <p role="alert" className="team-analysis-empty">Season statistics could not be loaded. <button onClick={retry}>Retry</button></p> :
    <p role="status" className="team-analysis-empty">Loading season statistics…</p>;
}
const cover = (metric:SeasonValue|undefined) => metric?.value==null?"No metric coverage":`${metric.matches} contributing matches · ${metric.population} eligible teams`;
function Tooltip({label,metric,keyName}:{label:string;metric:SeasonValue|undefined;keyName:SeasonMetric}) {
  const formula=keyName==="passAccuracy"?"Total recorded completed passes ÷ total attempts.":keyName==="pointsPerMatch"?"Official points ÷ completed matches in the filter window.":keyName==="position"?"Standings order under the season’s rules and selected match window.":keyName==="progressivePasses"?"Attempts that move at least 10 metres closer to goal per nominal 90 minutes.":keyName==="finalThirdEntries"?"Passes originating outside and entering the attacking third per covered match.":metricUnit(keyName)==="per match"?"Mean over matches with a recorded value.":"Uses the same definition and aggregation as Performance.";
  return <span title={`${label} · ${metricUnit(keyName)} · ${formula} ${cover(metric)}`}>{label}</span>;
}

const ordinalRules = new Intl.PluralRules("en", {type:"ordinal"});
const ordinalSuffix = {one:"st",two:"nd",few:"rd",other:"th",zero:"th",many:"th"};

function ordinal(position:number) {
  return `${position}${ordinalSuffix[ordinalRules.select(position)]}`;
}

function leagueRank(metric:SeasonValue|undefined) {
  return metric?.rank==null?"—":`${ordinal(metric.rank)} / ${metric.population}`;
}

const rateDefinitions:Partial<Record<SeasonMetric,string>> = {
  shotAccuracy:"Shots on target ÷ total shots",
  goalConversion:"Goals ÷ total shots",
  passAccuracy:"Completed passes ÷ passes attempted",
  tackleSuccess:"Tackles that gained possession ÷ tackles attempted",
  longPassAccuracy:"Completed long passes ÷ long passes attempted",
  crossCompletion:"Completed crosses ÷ crosses attempted",
  finalThirdCompletion:"Completed final-third passes ÷ final-third passes attempted",
  savePercentage:"Saves ÷ opponent shots on target",
};

type MatchupRow = {
  key:SeasonMetric; label:string; unit:string;
  a:SeasonValue|undefined; b:SeasonValue|undefined;
};

const relativeFormat = new Intl.NumberFormat(undefined,{minimumFractionDigits:1,maximumFractionDigits:1,signDisplay:"exceptZero"});

function MatchupDetails({rows,names}: {rows:MatchupRow[];names:[string,string]}) {
  const [sort,setSort]=useState(-1);
  const [descending,setDescending]=useState(false);
  const fullHeaders=["Metric",names[0],names[1],`${names[0]} − ${names[1]}`,`% vs ${names[1]}`,
    `${names[0]} % vs league avg`,`${names[1]} % vs league avg`,`${names[0]} rank`,`${names[1]} rank`];
  const columns=[0,4,5,6];
  const relativeHeaders=["Metric",`${names[0]} vs ${names[1]} (%)`,`${names[0]} vs Bundesliga (%)`,`${names[1]} vs Bundesliga (%)`];
  const entries=rows.map(row=>{
    const {a,b,key,label,unit}=row;
    const difference=a?.value!=null&&b?.value!=null?a.value-b.value:null;
    const relative=relativeDeviation(a?.value,b?.value);
    const leagueA=relativeDeviation(a?.value,a?.average);
    const leagueB=relativeDeviation(b?.value,b?.average);
    return {
      key,label,difference,unit,
      sort:[label,a?.value,b?.value,difference,relative,leagueA,leagueB,a?.rank,b?.rank],
      exportValues:[label,unit,a?.value,b?.value,difference,relative,leagueA,leagueB,leagueRank(a),leagueRank(b)],
    };
  }).sort((a,b)=>{
    if(sort===-1)return 0;
    const left=a.sort[sort],right=b.sort[sort];
    if(left==null||right==null)return left==null?(right==null?0:1):-1;
    const order=typeof left==="number"&&typeof right==="number"?left-right:String(left).localeCompare(String(right));
    return order?(descending?-order:order):a.label.localeCompare(b.label);
  });
  const exportCsv=()=>{
    const csvHeaders=[fullHeaders[0],"Unit (percentage differences in pp)",...fullHeaders.slice(1)];
    const csv=[csvHeaders,...entries.map(entry=>entry.exportValues)].map(row=>row.map(value=>{
      if(value==null||value==="—")return "";
      const content=typeof value==="string"&&/^[=+@\-\t\r]/.test(value)?`'${value}`:String(value);
      return `"${content.replaceAll('"','""')}"`;
    }).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");
    link.href=url;
    link.download="bundesliga-team-comparison.csv";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <details className="comparison-full-table comparison-details">
    <summary>Relative Differences</summary>
    <div className="matchup-table-tools"><button type="button" onClick={exportCsv}>Export CSV</button></div>
    <div className="comparison-table-scroll" tabIndex={0} role="region" aria-label="Detailed team comparison">
      <table><thead><tr>{columns.map((index,visibleIndex)=><th key={index} scope="col"
        className={index===5?"matchup-a":index===6?"matchup-b":undefined}
        aria-sort={sort===index?(descending?"descending":"ascending"):"none"}>
        <button type="button" onClick={()=>{setSort(index);setDescending(sort===index?!descending:false);}}>
          {relativeHeaders[visibleIndex]}{sort===index&&(descending?" ↓":" ↑")}
        </button></th>)}</tr></thead>
        <tbody>{entries.map(entry=><tr key={entry.key}><th scope="row">{entry.label}</th>
          {columns.slice(1).map(index=>{
            const value=entry.sort[index];
            return <td key={index} className={index===5?"matchup-a":index===6?"matchup-b":undefined}
              title={index===4&&entry.unit==="%"&&entry.difference!==null?signed(entry.difference,"%"):undefined}>
              {typeof value==="number"?`${relativeFormat.format(value)}%`:"—"}
            </td>;
          })}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}

function MatchupMetrics({clubs,names,shortNames,keys,historicalMode}: {
  clubs:[ClubSeason|undefined,ClubSeason|undefined]; names:[string,string]; shortNames:[string,string]; keys:SeasonMetric[]; historicalMode?:"actual"|"relative"
}) {
  const {t}=useI18n();
  const rows=keys.map(key=>({
    key,label:metricLabel(key,t),unit:metricUnit(key),a:clubs[0]?.metrics[key],b:clubs[1]?.metrics[key],
  }));
  const deviationLimit=symmetricDeviationLimit(rows.flatMap(({a,b})=>[a,b].map(metric=>relativeDeviation(metric?.value,metric?.average))));
  return <section className={`panel comparison-card matchup-metrics matchup-relative${historicalMode?" season-change-metrics":""}`}>
    <header><h3>Head-to-Head Comparison</h3>
      <p>{historicalMode==="actual"?"Actual values share a zero-based scale within each metric. Dashed markers show each season’s own Bundesliga average.":historicalMode==="relative"?"Each season uses its own Bundesliga average. Both seasons share a percentage scale within this category.":"Bars show the percentage difference from the Bundesliga average on one scale per category. Hover over a bar for its league index (average = 100)."}</p>
    </header>
    <div className="club-benchmark-row club-benchmark-header">
      <span>Metric</span><strong className="matchup-a benchmark-club-name">{names[0]}</strong>
      {historicalMode==="actual"?<span className="benchmark-legend">Actual values</span>:<div className="benchmark-legend benchmark-relative-legend">
        <span>−{formatNumber(deviationLimit)}%</span><span><i aria-hidden="true"/>League avg</span><span>+{formatNumber(deviationLimit)}%</span>
      </div>}
      <strong className="matchup-b benchmark-club-name">{names[1]}</strong>
      {historicalMode&&<strong>Season change</strong>}
    </div>
    {rows.map(({key,label,unit,a,b})=>{
      const average=a?.average??b?.average;
      const deviations=[a,b].map(metric=>relativeDeviation(metric?.value,metric?.average));
      const hasDeviations=deviations.some(value=>value!==null);
      const definition=rateDefinitions[key];
      const method=definition?`${definition} × 100, using summed paired totals.`:
        key==="possession"?"Mean of recorded match possession shares.":"Mean of recorded counts over covered completed matches. Event coding follows the source data.";
      const direction=lowerIsRankedHigher(key)?"Lower":"Higher";
      const cell=(metric:SeasonValue|undefined,side:number)=>{
        const index=unit==="rank"?null:leagueIndex(metric?.value,metric?.average);
        return <div className={side?"club-benchmark-value matchup-b":"club-benchmark-value matchup-a"}
          title={`${cover(metric)}${index===null?"":` · League index ${formatNumber(Math.round(index*10)/10)} (average = 100)`}`}>
          <strong>{valueText(key,metric?.value)}</strong>
          <small>{metric?.rank==null?"—":`#${metric.rank}/${metric.population}`}{historicalMode&&` · Avg ${valueText(key,metric?.average)}`}</small>
        </div>;
      };
      const delta=a?.value!=null&&b?.value!=null?b.value-a.value:null;
      const relative=delta!==null&&a?.value&&unit!=="%"?100*delta/a.value:null;
      const rankChange=a?.rank!=null&&b?.rank!=null?a.rank-b.rank:null;
      const directionality=["goals","pointsPerMatch"].includes(key)?1:["conceded","redCards","ownGoals"].includes(key)?-1:0;
      const impact=(delta??0)*directionality;
      return <div className="club-benchmark-row matchup-metric" key={key}>
        <div className="club-benchmark-metric">
          <strong><span tabIndex={0} title={`${label} · ${unit==="%"?"Percentage":unit}. ${method} ${direction} values rank first among eligible clubs. Ties share a rank.`}>{label}</span></strong>
          <small>{historicalMode?(unit==="%"?"Percentage":unit):average==null?"League average —":`League avg ${valueText(key,average)}${unit==="%"?"":` ${unit}`}`}{lowerIsRankedHigher(key)?" · Lower values rank first":""}</small>
        </div>
        {cell(a,0)}
        <div className="club-benchmark-chart">
          {historicalMode==="actual"?<div className="club-benchmark-track benchmark-relative-track">
            {[a,b].map((metric,side)=>{
              if(metric?.value==null)return null;
              const max=Math.max(1,...[a?.value,b?.value,a?.average,b?.average].map(value=>value??0))*1.05;
              return <span key={side} className={`historical-actual-lane matchup-${side?"b":"a"}`}><i className={`club-benchmark-bar matchup-${side?"b":"a"}`} style={{left:0,width:`${100*metric.value/max}%`}}
                title={`${names[side]} · ${valueText(key,metric.value)} · League average ${valueText(key,metric.average)}`}>
              </i>{metric.average!=null&&<b className="historical-average-marker" style={{left:`${100*metric.average/max}%`}}/>}</span>;
            })}
          </div>:<div className="club-benchmark-track benchmark-relative-track">
            <i className="club-benchmark-reference" aria-hidden="true"/>
            {!hasDeviations?<span className="benchmark-unavailable">Unavailable</span>:deviations.map((value,side)=>{
              if(value===null)return null;
              const length=50*value/deviationLimit;
              const metric=side?b:a;
              const index=leagueIndex(metric?.value,metric?.average);
              const description=`${names[side]} ${relativeFormat.format(value)}% vs Bundesliga average${index===null?"":` · League index ${formatNumber(Math.round(index*10)/10)} (average = 100)`}`;
              return <i key={side} className={`club-benchmark-bar matchup-${side?"b":"a"}${value===0?" benchmark-at-average":""}`}
                role="img" aria-label={description} title={description}
                style={{left:`${50+Math.min(0,length)}%`,width:`${Math.abs(length)}%`}}/>;
            })}
          </div>}
        </div>
        {cell(b,1)}
        {historicalMode&&<div className="season-change-value" data-impact={impact>0?"better":impact<0?"worse":"neutral"}>
          <strong>{signed(delta,unit)}</strong>
          {unit!=="%"&&delta!==null&&<small>{relative===null?"Relative change —":`${signed(relative,"")}%`}</small>}
          <small>{rankChange===null?"Rank —":rankChange===0?"Rank unchanged":`Rank ${rankChange>0?"up":"down"} ${Math.abs(rankChange)}`}</small>
        </div>}
      </div>;
    })}
    <MatchupDetails rows={rows} names={shortNames}/>
  </section>;
}

type ComparisonView=AnalyticalSection;
export function TeamComparisonWorkspace({data,teamId,season,view,onViewChange}: {data:Dashboard;teamId:number;season:string;view?:ComparisonView;onViewChange?:(view:ComparisonView)=>void}) {
  const otherTeam = data.teams.find(team=>team.id!==teamId);
  if (!otherTeam) return <p className="team-analysis-empty">Two clubs are needed for a comparison.</p>;
  return <SameSeasonComparison data={data} season={season} initial={[teamId,otherTeam.id]} view={view} onViewChange={onViewChange}/>;
}

function SameSeasonComparison({data,season,initial,view:controlledView,onViewChange}: {data:Dashboard;season:string;initial:[number,number];view?:ComparisonView;onViewChange?:(view:ComparisonView)=>void}) {
  const [teams,setTeams]=useState(initial);
  const [localView,setLocalView]=useState<ComparisonView>("stats");
  const view=controlledView??localView;
  const setView=(next:ComparisonView)=>{setLocalView(next);onViewChange?.(next);};
  const [spatialOpened,setSpatialOpened]=useState(false);

  const latestMatchday=Math.min(fullScope.to,Math.max(0,...completed(data.matches).map(match=>match.week)));
  const lastSelectable=Math.max(1,latestMatchday);
  const [requestedScope,setScope]=useState(fullScope);
  const scope={...requestedScope,from:Math.min(requestedScope.from,lastSelectable),to:Math.min(requestedScope.to,lastSelectable)};
  const [category,setCategory]=useState<TeamAnalysisCategory>("attacking");
  const {t}=useI18n();
  const {result,retry}=useSummaries([season],scope);
  const club=(id:number)=>result?.value?.summaries[0]?.clubs.find(item=>item.team.id===id);
  const clubs:[ClubSeason|undefined,ClubSeason|undefined]=[club(teams[0]),club(teams[1])];
  const names=teams.map((id,index)=>data.teams.find(team=>team.id===id)?.name??`Team ${index?"B":"A"}`) as [string,string];
  const keys=TEAM_ANALYSIS_METRICS[category].map(metric=>metric.key);
  const roster=[...data.teams].sort((a,b)=>a.name.localeCompare(b.name));
  const update=(index:number,id:number)=>setTeams(previous=>{
    const other=previous[index===0?1:0];
    if(id===other || !data.teams.some(team=>team.id===id))return previous;
    return index===0?[id,other]:[other,id];
  });
  return <div className="comparison-workspace same-season-comparison">
    {view!=="tactical"&&<section className="panel comparison-selection" aria-labelledby="comparison-selection-title">
      <header><h2 id="comparison-selection-title">Compare clubs</h2><p><CalendarDays size={14} aria-hidden="true"/> {formatSeason(season)}</p></header>
      <div className="comparison-team-pair">
        {teams.map((id,index)=>{
          const name=names[index];
          const entry=club(id),other=teams[index===0?1:0];
          return <section key={index} className={`comparison-team-card ${index?"comparison-team-blue":"comparison-team-red"}`}>
            {data.logos[name]&&<img src={data.logos[name]} alt=""/>}
            <div className="comparison-team-name">
              <h3>{data.fullTeamNames?.[name]??name}
                {entry?.position!=null&&<span className="comparison-position" title="League position in this match window"
                  aria-label={`League position in this match window: ${ordinal(entry.position)}`}>{ordinal(entry.position)}</span>}
              </h3>
            </div>
            <div className="comparison-team-controls">
              <label><select aria-label={index?"Second club":"First club"} value={id} onChange={event=>update(index,Number(event.target.value))}>
                {roster.filter(team=>team.id!==other).map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            </div>
          </section>;
        })}
        <button type="button" className="comparison-swap" aria-label="Swap teams" title="Swap teams"
          onClick={()=>setTeams(([a,b])=>[b,a])}><ArrowLeftRight size={18}/></button>
      </div>
    </section>}
  <div className="comparison-toolbar">
    <AnalyticalSectionNavigation value={view} onChange={next=>{setView(next);if(next==="spatial")setSpatialOpened(true);}} label="Team Comparison analytical sections"/>
    {view!=="tactical"&&<div className="team-analysis-shared-filters">
      {(["from","to"] as const).map(key=><label key={key}><span>{t(key==="from"?"filters.fromMatchday":"filters.toMatchday")}</span><select disabled={!latestMatchday} aria-label={key==="from"?"From matchday":"To matchday"} value={scope[key]} onChange={event=>{
        const value=Number(event.target.value);
        setScope({...scope,[key]:value,...(key==="from"?{to:Math.max(scope.to,value)}:{from:Math.min(scope.from,value)})});
      }}>{latestMatchday?Array.from({length:latestMatchday},(_,index)=><option key={index}>{index+1}</option>):<option value={1}>—</option>}</select></label>)}
      <label><span>{t("filters.venue")}</span><select aria-label={t("filters.venue")} value={scope.venue} onChange={event=>setScope({...scope,venue:event.target.value as SeasonScope["venue"]})}><option value="all">{t("filters.allVenues")}</option><option value="home">{t("filters.home")}</option><option value="away">{t("filters.away")}</option></select></label>
      <label><span>{t("filters.matchPeriod")}</span><select aria-label={t("filters.matchPeriod")} value={scope.period} onChange={event=>setScope({...scope,period:event.target.value as SeasonScope["period"]})}><option value="ft">Full match</option><option value="fh">First half</option><option value="sh">Second half</option></select></label>
    </div>}
    {view!=="tactical"&&!latestMatchday&&<p>No completed matchdays for this season.</p>}
    {view==="stats"&&scope.period!=="ft"&&<p>Points and league positions use full-match results and are unavailable for half selections.</p>}
  </div>
  <div hidden={view!=="stats"}>
    <div className="comparison-statistics">
      <div className="matchup-categories">
        <nav className="team-analysis-tabs" aria-label="Comparison categories">
          {ALL_TEAM_ANALYSIS_CATEGORIES.map(key=>{
            const Icon=comparisonCategoryIcons[key];
            return <button key={key} type="button" className={category===key?"active":""}
            aria-pressed={category===key} onClick={()=>setCategory(key)}>
            <Icon size={15} aria-hidden="true"/>
            {t(`teamAnalysis.${key==="possession"?"possessionCategory":key}`)}
          </button>;})}
        </nav>
      </div>
      <div className="comparison-statistics-layout">
        <div className="comparison-statistics-matchup">
          {result?.value?<MatchupMetrics clubs={clubs} names={names}
            shortNames={[data.shortTeamNames?.[String(teams[0])]??names[0],data.shortTeamNames?.[String(teams[1])]??names[1]]} keys={keys}/>
          :<LoadState error={result?.failed} retry={retry}/>}
        </div>
        <div className="panel comparison-scatter-block statistics-league-chart">
          <header className="comparison-scatter-heading"><h3>{t("teamAnalysis.leagueComparison")}</h3></header>
          <div id="comparison-league-chart">
            <TeamAnalysisScatter hideHeading showSeason data={data} teamId={teams[0]} comparisonTeamId={teams[1]} filters={scope} category={category}/>
          </div>
        </div>
        <aside className="comparison-insights">
          <InsightsPlaceholder insightType="team-comparison-statistics"
            description="Insights for the head-to-head chart, relative differences and league scatterplot."/>
        </aside>
      </div>
    </div>
  </div>
  {view==="tactical"&&<TacticalAnalysisPlaceholder/>}
  {spatialOpened&&<div className="team-comparison-spatial" hidden={view!=="spatial"}>
    <TeamSpatialComparison data={data} teams={teams} season={season} scope={scope}/>
  </div>}
  </div>;
}

const historicalColors=["#5c87ab","#9476ae","#638d80","#ae845f","#73839a"];
const currentColor="var(--accent)";
const formationColors=["#c64b67","#52799d","#49847d","#a37a48","#8862a2","#64798a","#a85e41","#668244"];
type MetricReader=(item:HistoricalSeason,key:SeasonMetric)=>SeasonValue|undefined;
const ownMetric:MetricReader=(item,key)=>item.club?.metrics[key];
const againstMetric:MetricReader=(item,key)=>item.club?.against?.[key as keyof NonNullable<ClubSeason["against"]>];

function seasonSeries(range:HistoricalSeason[],reference:string,name:string,color:string,values:(item:HistoricalSeason)=>number|null,detail:(item:HistoricalSeason,value:number|null)=>string):ChartSeries {
  return {name,color,points:range.map(item=>{
    const value=values(item);
    return {season:item.season,value,detail:detail(item,value),ongoing:item.ongoing,reference:item.season===reference};
  })};
}

function evolutionLabel(key:EvolutionMetric,t:(key:string)=>string){
  return key==="goalDifference"?"Goal difference":key==="pointsPerMatch"?"Points per game":metricLabel(key,t);
}
function evolutionRow(item:HistoricalSeason,key:EvolutionMetric,against:boolean):SeasonValue|undefined {
  if(key!=="goalDifference")return (against?againstMetric:ownMetric)(item,key);
  const goals=ownMetric(item,"goals"),conceded=ownMetric(item,"conceded");
  return {value:goals?.value!=null&&conceded?.value!=null?goals.value-conceded.value:null,
    average:goals?.average!=null&&conceded?.average!=null?goals.average-conceded.average:null,
    matches:item.club?.team.played??0,rank:null,percentile:null,population:goals?.population??0};
}
function evolutionFormat(value:number|null|undefined,key:EvolutionMetric,view:"actual"|"index"|"rank"="actual"){
  return value==null?"—":view==="rank"||(view==="actual"&&key==="position")?ordinal(Math.round(value)):`${value.toFixed(2)}${view==="actual"&&percentageMetric(key)?"%":""}`;
}
function StatisticalEvolution({range,reference,t,basis,stage,loading,failed,retry,club,logo}:{
  range:HistoricalSeason[];reference:string;t:(key:string)=>string;basis:OverviewBasis;stage:number;loading:boolean;failed?:boolean;retry:()=>void;club:string;logo?:string
}){
  const [modalOpen,setModalOpen]=useState(false);
  const [category,setCategory]=useState<TeamAnalysisCategory|"results">("attacking");
  const [metric,setMetric]=useState<EvolutionMetric>("goals");
  const [against,setAgainst]=useState(false);
  const [view,setView]=useState<"actual"|"index"|"rank">("actual");
  const useAgainst=against&&category!=="results";
  const keys:EvolutionMetric[]=category==="results"?["pointsPerMatch","position","goals","conceded","goalDifference"]:TEAM_ANALYSIS_METRICS[category].map(item=>item.key);
  const read=(item:HistoricalSeason,key:EvolutionMetric)=>evolutionRow(item,key,useAgainst);
  const matrixSeasons=[...range].sort((a,b)=>b.season.localeCompare(a.season));
  const latestSeason=matrixSeasons[0]?.season??reference;
  const shownValue=(row:SeasonValue|undefined)=>view==="index"?leagueIndex(row?.value,row?.average):view==="rank"?row?.rank??null:row?.value??null;
  const title=evolutionLabel(metric,t);
  const benchmark=historicalBenchmark(range.map(item=>({season:item.season,value:shownValue(read(item,metric))})),latestSeason);
  const actualRank=metric==="position"&&view==="actual";
  const trend=seasonSeries([...range].sort((a,b)=>a.season.localeCompare(b.season)),reference,useAgainst?"Against":"For",currentColor,item=>shownValue(read(item,metric)),(item,value)=>{
    const row=read(item,metric);
    return `${formatSeason(item.season)} · ${title}: ${evolutionFormat(value,metric,view)} · ${view==="index"?"League average = 100 · ":""}Actual ${evolutionFormat(row?.value,metric)} · League average ${metric==="position"?formatNumber(row?.average):evolutionFormat(row?.average,metric)} · Rank ${leagueRank(row)} · ${cover(row)}${item.ongoing?" · Ongoing season":""}`;
  });
  const league=seasonSeries([...range].sort((a,b)=>a.season.localeCompare(b.season)),reference,"Bundesliga average","#728ba4",item=>{
    const row=read(item,metric);
    return view==="rank"||actualRank?null:view==="index"?leagueIndex(row?.average,row?.average):row?.average??null;
  },(item,value)=>`${formatSeason(item.season)} · Bundesliga average: ${evolutionFormat(value,metric,view)}`);
  const current=shownValue(read(range.find(item=>item.season===latestSeason)??{season:latestSeason,ongoing:true},metric));
  const change=current!==null&&benchmark.value!==null?current-benchmark.value:null;
  const changeText=change===null?"—":view==="rank"||view==="actual"&&metric==="position"?`${change>0?"+":""}${change.toFixed(2)} places`:`${change>0?"+":""}${change.toFixed(2)}${view==="actual"&&percentageMetric(metric)?" pp":view==="index"?" index points":" per match"}`;
  const context=`${useAgainst?"Against":"For"} · ${basis==="stage"?`First ${stage} completed games per season`:"Season · completed games"} · ${view==="actual"?"Actual values":view==="rank"?"League ranking":"League index"}`;
  return <div className="statistical-evolution-workspace">
    <section className="panel comparison-card historical-matrix statistical-evolution-matrix historical-all-seasons-matrix">
      <header><h3>Historical Statistical Matrix</h3><p>Select a metric to explore its historical evolution. Missing values remain unavailable.</p></header>
      <div className="comparison-inline-controls">
        <label>Category<select aria-label="Category" value={category} onChange={event=>{const next=event.target.value as typeof category;setCategory(next);setMetric(current=>(next==="results"?["pointsPerMatch","position","goals","conceded","goalDifference"]:TEAM_ANALYSIS_METRICS[next].map(metric=>metric.key)).includes(current)?current:next==="results"?"pointsPerMatch":TEAM_ANALYSIS_METRICS[next][0].key);}}>
          <option value="results">Results</option>{ALL_TEAM_ANALYSIS_CATEGORIES.map(key=><option key={key} value={key}>{t(`teamAnalysis.${key==="possession"?"possessionCategory":key}`)}</option>)}</select></label>
        <label>For / Against<select value={useAgainst?"against":"for"} disabled={category==="results"} onChange={event=>setAgainst(event.target.value==="against")}><option value="for">For</option><option value="against">Against</option></select></label>
        <label>Display<select aria-label="Table display" value={view} onChange={event=>setView(event.target.value as typeof view)}><option value="actual">Actual values</option><option value="rank">League ranking</option><option value="index">League index (average = 100)</option></select></label>
      </div>
      {loading?<LoadState error={failed} retry={retry}/>:<>
      <div className="comparison-table-scroll" role="region" aria-label="Historical statistical matrix" tabIndex={0}><table className="evolution-table">
        <thead><tr><th scope="col">Metric</th>{matrixSeasons.map((item,index)=><th scope="col" key={item.season} className={index===0?"historical-latest-column":undefined} title={item.ongoing?"Ongoing season":undefined}>{shortSeason(item.season)}{item.ongoing?"*":""}</th>)}<th scope="col" className="historical-trend-column">Trend</th><th scope="col" className="historical-difference-column">Vs historical avg</th></tr></thead>
        <tbody>{keys.map(key=>{
          const observations=range.map(item=>({season:item.season,value:shownValue(read(item,key))}));
          const historical=historicalBenchmark(observations,latestSeason),latest=observations.find(item=>item.season===latestSeason)?.value;
          const change=latest!=null&&historical.value!==null?latest-historical.value:null;
          const meaningful=performanceDirection(key,useAgainst),direction=view==="rank"&&meaningful?"lower":meaningful;
          const neutral=change===null||Math.abs(change)<.000001||(view==="rank"||key==="position")&&Math.round(change)===0;
          const impact=neutral||!direction?"neutral":(direction==="higher"?change!>0:change!<0)?"better":"worse";
          const difference=change===null?"—":view==="rank"||view==="actual"&&key==="position"?`${Math.round(change)>0?"+":""}${Math.round(change)} places`:`${change>0?"+":""}${change.toFixed(2)}${view==="actual"&&percentageMetric(key)?" pp":""}`;
          return <tr key={key} data-active={modalOpen&&metric===key} onClick={()=>{setMetric(key);setModalOpen(true);}}>
            <th scope="row"><button className="historical-metric-selector" type="button" aria-pressed={metric===key} aria-haspopup="dialog" onClick={event=>{event.stopPropagation();setMetric(key);setModalOpen(true);}}>{evolutionLabel(key,t)}</button></th>
            {matrixSeasons.map((item,index)=>{const row=read(item,key);return <td key={item.season} className={index===0?"historical-latest-column":undefined} title={`League average ${evolutionFormat(row?.average,key)} · ${cover(row)}`}>{view==="rank"?leagueRank(row):evolutionFormat(shownValue(row),key,view)}</td>;})}
            <td className="historical-trend-column"><HistoricalTrendCell observations={observations} metric={key} view={view} textOnly/></td>
            <td className="historical-difference-column" data-impact={impact} title="Latest season minus historical average. Frequency metrics are neutral; trend direction does not imply improvement.">{difference}</td>
          </tr>;
        })}</tbody></table></div>
        <small>{range.some(item=>item.ongoing)?"* Ongoing season. ":""}{basis==="stage"?`Each season uses the first ${stage} completed club games.`:"Rates use completed games in each season."} — means unavailable; league index is unavailable for a zero league average. Goal-difference league ranking is unavailable.</small>
      </>}
    </section>
    <HistoricalSeasonComparison logo={logo} seasons={range} latest={latestSeason} against={useAgainst} view="actual" value={(season,key)=>read(season,key)?.value??null} label={key=>evolutionLabel(key,t)} format={(value,key)=>evolutionFormat(value,key,"actual")} t={t} context={basis==="stage"?`Same Stage · First ${stage} games`:"Season · Completed games"} loading={loading}/>
    {modalOpen&&<HistoricalEvolutionModal club={club} logo={logo} metric={title} context={context} current={evolutionFormat(current,metric,view)} average={evolutionFormat(benchmark.value,metric,view)} difference={changeText} onClose={()=>setModalOpen(false)}>
      <SeasonChart title={`${title} across seasons`} wide research large benchmark={{value:benchmark.value,label:"Historical average"}} formatValue={value=>evolutionFormat(value,metric,view)} sharedScale series={[{...trend,name:club,reverse:view==="rank"||actualRank},{...league,dashed:true,reverse:view==="rank"||actualRank}]}/>
    </HistoricalEvolutionModal>}

  </div>;
}

function MetricProgression({metric,title,selected,reference,trajectory,history,mode,against}:{metric:EvolutionMetric;title:string;selected:string[];reference:string;trajectory:Record<string,TrajectoryPoint[]>;history:Record<string,SeasonHistory>;mode:EvolutionProgressMode;against:boolean}){
  const rank=metric==="position",percent=percentageMetric(metric);
  const effectiveMode=rank?"match":percent&&mode==="total"?"running":mode;
  const maxWeek=Math.max(0,...selected.flatMap(key=>trajectory[key]?.map(point=>point.week)??[]));
  const series:ChartSeries[]=selected.map((key,index)=>{
    const matches=trajectory[key]??[];
    const values=rank?new Map(history[key]?.ranks.filter(row=>row.week<=Math.max(0,...matches.map(point=>point.week))).map(row=>[row.week,row.position])):evolutionProgressValues(matches,metric,effectiveMode,against);
    return {name:formatSeason(key),color:key===reference?currentColor:historicalColors[index%historicalColors.length],reverse:rank,
      points:Array.from({length:maxWeek},(_,i)=>{
        const week=i+1,value=values.get(week)??null;
        return {season:String(week),value,detail:`${formatSeason(key)} · Matchday ${week} · ${title}: ${evolutionFormat(value,metric)} · ${effectiveMode==="total"?"Cumulative total":effectiveMode==="running"?"Season-to-date average":effectiveMode==="rolling"?"Rolling five-match average":"Matchday value"}`,ongoing:false,reference:key===reference&&week===Math.max(0,...matches.map(point=>point.week))};
      })};
  });
  return selected.length?<SeasonChart key={`${metric}:${against}:${effectiveMode}`} title={`${title} by matchday`} series={series} matchdays wide research formatValue={value=>evolutionFormat(value,metric)}/>:<p className="team-analysis-empty">Select at least one season to display its progression.</p>;
}

function CampaignComparison({selected,reference,trajectory,history}:{selected:string[];reference:string;trajectory:Record<string,TrajectoryPoint[]>;history:Record<string,SeasonHistory>}){
  const currentMatches=trajectory[reference]??[];
  const currentWeek=currentMatches.length?Math.max(...currentMatches.map(point=>point.week)):undefined;
  const summaries=selected.filter(key=>key!==reference).flatMap(key=>{
    const matches=trajectory[key]?.filter(point=>currentWeek!==undefined&&point.week<=currentWeek);
    if(!currentWeek||matches?.at(-1)?.week!==currentWeek||matches.length!==currentMatches.length)return [];
    const totals=(points:TrajectoryPoint[],key:TrajectoryMetric)=>{
      const values=points.map(point=>point.values[key]);
      return values.every((value):value is number=>value!==null)?values.reduce((sum,value)=>sum+value,0):null;
    };
    const changes=(["pointsPerMatch","goals","conceded"] as const).map(key=>{
      const a=totals(currentMatches,key),b=totals(matches,key);
      return a===null||b===null?null:a-b;
    });
    const currentRank=history[reference]?.ranks.find(row=>row.week===currentWeek)?.position;
    const pastRank=history[key]?.ranks.find(row=>row.week===currentWeek)?.position;
    const rankChange=currentRank!=null&&pastRank!=null?pastRank-currentRank:null;
    return [{key,changes,rankChange}];
  });
  return <>
    {currentWeek!==undefined&&<><h4>Campaign comparison after matchday {currentWeek}</h4>
      {summaries.length?<div className="evolution-campaigns">{summaries.map(({key,changes,rankChange})=><article key={key}>
        <h5>Compared with {formatSeason(key)}</h5><dl>
          {["Points","Goals scored","Goals conceded","League position"].map((label,index)=><div key={label}><dt>{label}</dt>
            <dd>{index<3?signed(changes[index],""):rankChange===null?"—":rankChange===0?"Same":`${Math.abs(rankChange)} ${rankChange>0?"higher":"lower"}`}</dd></div>)}
        </dl></article>)}</div>:<p className="team-analysis-empty">No selected historical campaign has the same number of completed matches at this matchday.</p>}</>}
  </>;
}

const styleDimensions=[
  {key:"possession",label:"Possession",method:"Mean share of possession in matches with data."},
  {key:"passes",label:"Passing volume",method:"Pass attempts per match."},
  {key:"progressivePasses",label:"Ball progression",method:"Validated progressive pass attempts per 90 minutes."},
  {key:"shots",label:"Shooting",method:"Shots per match."},
  {key:"crosses",label:"Crossing",method:"Crosses attempted per match."},
  {key:"recoveries",label:"Ball recoveries",method:"Ball recoveries per match."},
] as const;

function StyleRadar({range,reference}:{range:HistoricalSeason[];reference:string}){
  const playable=range.filter(item=>item.club);
  const [selection,setSelection]=useState<string[]>();
  const picked=selection?.filter(key=>playable.some(item=>item.season===key))??playable.slice(-3).map(item=>item.season);
  const samples=playable.filter(item=>picked.includes(item.season));
  const dimensions=styleDimensions.filter(({key})=>samples.length>0&&samples.every(item=>{
    const row=ownMetric(item,key);
    return leagueIndex(row?.value,row?.average)!==null;
  }));
  const index=(item:HistoricalSeason,key:SeasonMetric)=>{
    const row=ownMetric(item,key);
    return leagueIndex(row?.value,row?.average);
  };
  const max=Math.max(125,...samples.flatMap(item=>dimensions.map(({key})=>index(item,key)??0)));
  const bound=Math.ceil(max/25)*25;
  const cx=260,cy=153,r=105;
  const point=(axis:number,value:number)=>{
    const angle=axis*2*Math.PI/dimensions.length-Math.PI/2;
    return [cx+Math.cos(angle)*r*value/bound,cy+Math.sin(angle)*r*value/bound];
  };
  const polygon=(get:(axis:number)=>number)=>dimensions.map((_,axis)=>point(axis,get(axis)).join(",")).join(" ");
  return <section className="panel comparison-card evolution-radar">
    <header><h3>Playing Style Evolution</h3><p>League average = 100 in each season. A larger value means more of that action.</p></header>
    <fieldset className="evolution-season-pills"><legend>Radar seasons</legend>{playable.map(item=><label key={item.season}>
      <input type="checkbox" checked={picked.includes(item.season)} disabled={picked.includes(item.season)?picked.length<=2:picked.length>=3}
        onChange={()=>setSelection(picked.includes(item.season)?picked.filter(key=>key!==item.season):[...picked,item.season])}/>{formatSeason(item.season)}
    </label>)}</fieldset>
    {samples.length>=2&&dimensions.length>=3?<figure>
      <svg viewBox="0 0 520 308" role="img" aria-label="Playing style radar indexed to each season’s league">
        {[50,100,bound].map(value=><polygon key={value} points={polygon(()=>value)} className={value===100?"evolution-radar-base":"evolution-radar-grid"}/>)}
        {dimensions.map(({label,method},axis)=>{
          const [x,y]=point(axis,bound),[tx,ty]=point(axis,bound+16);
          return <g key={label}><line x1={cx} y1={cy} x2={x} y2={y} className="evolution-radar-grid"/>
            <text x={tx} y={ty+4} textAnchor="middle" tabIndex={0} aria-label={`${label}. ${method}`}><title>{method}</title>{label}</text>
          </g>;
        })}
        {samples.map((item,serie)=>{
          const color=item.season===reference?currentColor:historicalColors[serie];
          return <g key={item.season}><polygon points={polygon(axis=>index(item,dimensions[axis].key)!)} fill={color} fillOpacity=".10" stroke={color} strokeWidth="2"/>
            {dimensions.map(({key,label,method},axis)=>{
              const value=index(item,key)!;
              const [x,y]=point(axis,value);
              const description=`${formatSeason(item.season)} · ${label} ${formatNumber(value)} (league = 100). ${method}`;
              return <circle key={key} cx={x} cy={y} r={4} fill={color} tabIndex={0} aria-label={description}><title>{description}</title></circle>;
            })}</g>;
        })}
      </svg>
      <figcaption>{samples.map((item,i)=><span key={item.season} style={{color:item.season===reference?currentColor:historicalColors[i]}}>● {formatSeason(item.season)}</span>)}</figcaption>
    </figure>:<p className="team-analysis-empty">At least two seasons with three shared metrics are needed.</p>}
    {dimensions.length<styleDimensions.length&&<small>Some dimensions lack data for the selected seasons.</small>}
  </section>;
}

function FormationBars({range,history}:{range:HistoricalSeason[];history:Record<string,SeasonHistory>}){
  const [chosen,setChosen]=useState<string>();
  const names=[...new Set(range.flatMap(item=>history[item.season]?.formations.map(row=>row.formation)??[]))].sort();
  const color=(formation:string)=>formationColors[names.indexOf(formation)%formationColors.length];
  return <section className="panel comparison-card"><header><h3>Formation Evolution</h3><p>Shares are based on matches with a recorded starting formation.</p></header>
    {names.length>0&&<div className="evolution-formation-legend">{names.map(name=><button key={name} type="button" aria-pressed={chosen===name} onClick={()=>setChosen(chosen===name?undefined:name)}>
      <i style={{background:color(name)}}/>{name}</button>)}</div>}
    <div className="evolution-formation-bars">{range.map(item=>{
      const sample=history[item.season];
      return <div key={item.season} className="evolution-formation-row">
        <strong>{shortSeason(item.season)}</strong>
        {sample?.recorded?<div className="evolution-formation-track">{sample.formations.map(row=>{
          const share=100*row.count/sample.recorded;
          const detail=`${row.formation} · ${row.count} matches · ${formatNumber(share)}%`;
          return <button key={row.formation} type="button" aria-label={detail} title={detail} aria-pressed={chosen===row.formation}
            onClick={()=>setChosen(chosen===row.formation?undefined:row.formation)}
            style={{width:`${share}%`,background:color(row.formation),opacity:chosen&&chosen!==row.formation?0.23:1}}>
            {share>=16&&row.formation}
          </button>;
        })}</div>:<span>No recorded formations</span>}
        <small>{sample?.recorded?`${sample.recorded} matches`:"—"}</small>
      </div>;
    })}</div>
    {chosen&&<p className="evolution-formation-detail">{chosen} · {range.flatMap(item=>{
      const sample=history[item.season];
      if(!sample?.recorded)return [];
      const count=sample.formations.find(row=>row.formation===chosen)?.count??0;
      return [`${shortSeason(item.season)} ${count}/${sample.recorded} (${formatNumber(100*count/sample.recorded)}%)`];
    }).join(" · ")}</p>}
  </section>;
}

export function PlayingStyle({range,reference,history,t}:{range:HistoricalSeason[];reference:string;history:Record<string,SeasonHistory>;t:(key:string)=>string}){
  const metricKeys:SeasonMetric[]=["possession","passes","progressivePasses","crosses","dribbles","fastbreakShots","recoveries","interceptions","tackles"];
  const indicators=[
    ...metricKeys.map(key=>({label:metricLabel(key,t),percent:metricUnit(key)==="%",read:(item:HistoricalSeason)=>ownMetric(item,key)?.value??null})),
    {label:"Long-pass percentage",percent:true,read:(item:HistoricalSeason)=>history[item.season]?.longPassShare??null},
  ].filter(indicator=>range.some(item=>indicator.read(item)!==null));
  return <>
    <div className="evolution-overview-charts"><StyleRadar range={range} reference={reference}/><FormationBars range={range} history={history}/></div>
    <section className="panel comparison-card"><header><h3>Playing Style Indicators</h3></header>
      <div className="evolution-indicators">{indicators.map(({label,percent,read})=><article key={label}>
        <h4>{label}</h4><SeasonChart title={label} series={[seasonSeries(range,reference,label,currentColor,read,
          (item,value)=>`${formatSeason(item.season)} · ${formatNumber(value)}${percent&&value!==null?"%":""}`)]}/>
      </article>)}</div>
    </section>
  </>;
}

export function SeasonEvolutionWorkspace({data,teamId,season}: {data:Dashboard;teamId:number;season:string}) {
  const {t}=useI18n();
  const matchdays=data.teamAnalysisMatchdays?.[teamId];
  const seasons=[...new Set([...(matchdays?Object.keys(matchdays):data.teamAnalysisSeasons??[]),season])].sort();
  const pathname=usePathname();
  const [tab,setTab]=useState<"summary"|"evolution"|"spatial"|"tactical">(pathname.endsWith("/season-statistics")||pathname.endsWith("/statistical-evolution")?"evolution":"summary");
  const [overviewBasis,setOverviewBasis]=useState<OverviewBasis>("stage");
  const stage=completed(data.matches).filter(match=>match.homeId===teamId||match.awayId===teamId).length;
  const spatial=tab==="spatial";
  const rangeKeys=[...new Set([...(data.teamAnalysisSeasons??seasons),season])].sort();
  const {result,retry}=useSummaries(rangeKeys,fullScope,teamId,false,true,true,false,overviewBasis==="stage"?stage:undefined);
  const range:HistoricalSeason[]=(result?.value?.summaries??[]).map(summary=>({...summary,club:summary.clubs.find(club=>club.team.id===teamId&&club.team.played>0)}));
  return <div className="comparison-workspace season-evolution-workspace">
    <nav className="team-analysis-tabs analytical-section-tabs season-analytical-tabs" aria-label="Season Evolution analytical sections">
      {([["summary","Summary",ChartNoAxesColumnIncreasing],["evolution","Evolution",TrendingUp],["spatial","Spatial Analysis",MapIcon],["tactical","Tactical Analysis",Network]] as const).map(([key,label,Icon])=><button key={key} type="button" aria-pressed={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}><Icon size={16} aria-hidden="true"/>{label}</button>)}
    </nav>
    <Activity mode={tab==="summary"||tab==="evolution"?"visible":"hidden"}>
    <section className="panel comparison-card historical-filters" aria-label="Historical filters">
      <div className="comparison-inline-controls"><label>Comparison basis<select value={overviewBasis} onChange={event=>setOverviewBasis(event.target.value as OverviewBasis)}><option value="stage">Same Stage</option><option value="perMatch">Season</option></select></label></div>

      <p>{overviewBasis==="stage"?`First ${stage} completed games per season, including the ongoing season.`:"Per-game comparisons, including the ongoing season."}<span className="evolution-history-count">All {rangeKeys.length} available seasons</span></p>
    </section>
    <Activity mode={tab==="summary"?"visible":"hidden"}><div className="season-summary-view">{!result?.value?<LoadState error={result?.failed} retry={retry}/>:<SeasonEvolutionOverview range={range} reference={season} basis={overviewBasis} stage={stage}/>}</div></Activity>
    <Activity mode={tab==="evolution"?"visible":"hidden"}><StatisticalEvolution club={data.fullTeamNames?.[data.teams.find(team=>team.id===teamId)?.name??""]??data.teams.find(team=>team.id===teamId)?.name??"Club"} logo={data.logos[data.teams.find(team=>team.id===teamId)?.name??""]} range={range} reference={season} t={t} basis={overviewBasis} stage={stage} loading={!result?.value} failed={result?.failed} retry={retry}/></Activity>
    </Activity>
    <Activity mode={spatial?"visible":"hidden"}><SeasonSpatialWorkspace data={data} teamId={teamId} season={season}/></Activity>
    {tab==="tactical"&&<TacticalAnalysisPlaceholder/>}
  </div>;
}
