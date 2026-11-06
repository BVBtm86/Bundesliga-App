"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowLeftRight, ArrowRight, BarChart3, CalendarClock, CalendarDays, ChartNoAxesColumn, ChartNoAxesCombined, ClipboardList, LayoutDashboard, ListChecks,
  ChevronDown, ChevronLeft, ChevronRight, Database, Goal, Map as MapIcon,
  LoaderCircle, MapPin, Minus, RefreshCw, Search, Shield, Sparkles, Target, TrendingDown, TrendingUp, Trophy, UserRound, Users, X } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";
import SettingsMenu from "./settings-menu";
import { completed, goalSummary, goalTrend, leagueTrend, standings } from "@/lib/analytics";
import type { LeagueTrendMetric, LeagueTrendPoint } from "@/lib/analytics";
import { defaultMatchday, fixturesForMode, PERIODS, periodLabel as rawPeriodLabel, seasonPartLabel, venueLabel, seasonSubset, scoresForPeriod, statsForPeriod, teamVenueMatches } from "@/lib/filters";
import type { FixtureMode } from "@/lib/filters";
import type { Dashboard as Data, Match, MatchPeriod, SeasonPart, Team, TimelineEvent, VenueFilter } from "@/lib/types";
import type { MatchPrediction } from "@/lib/predictions";
import { aggregatePreviewStatistics, previewMetrics } from "@/lib/match-statistics";
import { ComparisonBars } from "./comparison-bars";
import MatchMomentum from "./match-momentum";
import TeamAnalysis from "./team-analysis";
import BundesligaHistory from "./bundesliga-history";
import InsightsPlaceholder from "./insights-placeholder";

type View = "overview" | "upcoming" | "results" | "standings" | "teams" | "teamAnalysis" | "players" | "predictions" | "goals" | "history";
const allNavigation = [
  {id:"overview" as View,label:"Overview",icon:LayoutDashboard},
  {id:"upcoming" as View,label:"Upcoming",icon:CalendarClock},
  {id:"results" as View,label:"Results",icon:ListChecks},
  {id:"standings" as View,label:"Standings",icon:Trophy},
  {id:"teams" as View,label:"Teams",icon:Shield},
  {id:"players" as View,label:"Players",icon:UserRound}
  ,{id:"history" as View,label:"History",icon:MapIcon}
];
const displaySeason = (s:string) => s.replace("-"," / ");
const shortSeason = (s:string) => {const [start,end]=s.split("-");return end?`${start}/${end.slice(-2)}`:s;};
const displayDate = (s:string,locale:Locale="en") => s ? new Intl.DateTimeFormat(({en:"en-GB",de:"de-DE",es:"es-ES",ro:"ro-RO"} as const)[locale],{day:"numeric",month:"short",year:"numeric",timeZone:"Europe/Berlin"}).format(new Date(s)) : "Date unavailable";
const percent = (value:number) => Math.round(value)+"%";
const abbreviate = (name:string) => name.replace("Borussia ","").replace("Eintracht ","").replace("Bayer 04 ","").replace("Bayer ","").replace("VfB ","").replace("FC ","");
const normalizedTeamLabel = (name:string) => name.toLowerCase().replace(/[^a-z0-9]/g,"");
type StandingsZone = {className:"champions"|"champions-league"|"europa-league"|"conference-league"|"relegation-playoff"|"relegated";label:string};
function configuredStandingsZone(outcomes:Array<{type:string;competitionId?:string;label?:string;teamIds:number[]}>,teamId:number,labels:{champions:string;championsLeague:string;europaLeague:string;conferenceLeague:string;relegationPlayoff:string;relegated:string}):StandingsZone|null {
  const candidates=outcomes.filter(outcome=>outcome.teamIds.includes(teamId));
  const classify=(outcome:typeof candidates[number]):StandingsZone|null=>{
    const type=outcome.type.toLowerCase().replace(/[^a-z]/g,"");
    const token=`${outcome.competitionId??""} ${outcome.label??""}`.toLowerCase().replace(/[^a-z]/g,"");
    if(type==="champion"||type==="champions")return {className:"champions",label:labels.champions};
    if(type==="relegated"||type==="directrelegation")return {className:"relegated",label:labels.relegated};
    if(type==="relegationplayoff"||type==="playoff")return {className:"relegation-playoff",label:labels.relegationPlayoff};
    if(token.includes("championsleague")||token.includes("ucl"))return {className:"champions-league",label:outcome.label??labels.championsLeague};
    if(token.includes("conferenceleague")||token.includes("uecl"))return {className:"conference-league",label:outcome.label??labels.conferenceLeague};
    if(token.includes("europaleague")||token.includes("uel")||token.includes("uefacup"))return {className:"europa-league",label:outcome.label??labels.europaLeague};
    return null;
  };
  const zones=candidates.map(classify).filter((zone):zone is StandingsZone=>Boolean(zone));
  return zones.find(zone=>zone.className==="champions")??zones.find(zone=>zone.className==="champions-league")??zones.find(zone=>zone.className==="europa-league")??zones.find(zone=>zone.className==="conference-league")??zones.find(zone=>zone.className==="relegation-playoff")??zones.find(zone=>zone.className==="relegated")??null;
}
function OverviewScorers({goals,teamId}:{goals:Array<{teamId:number;playerName:string|null;minute:number|null;addedTime:number;subtype:string|null}>;teamId:number}) {
  const scorers=goals.filter(goal=>goal.teamId===teamId).sort((a,b)=>(a.minute??999)-(b.minute??999));
  const name=(value:string|null)=>{if(!value)return "Unknown scorer";const parts=value.trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(" ")}`:value;};
  const grouped=new Map<string,{name:string|null;minutes:string[];tags:Set<string>}>();
  for(const goal of scorers){const key=goal.playerName??`unknown-${goal.minute}`;const entry=grouped.get(key)??{name:goal.playerName,minutes:[],tags:new Set<string>()};if(goal.minute!==null)entry.minutes.push(`${goal.minute}${goal.addedTime>0?`+${goal.addedTime}`:""}'`);if(goal.subtype==="penalty")entry.tags.add("(P)");if(goal.subtype==="own_goal")entry.tags.add("(OG)");grouped.set(key,entry);}
  return <div className="overview-scorers">{Array.from(grouped.values()).map((goal,index)=><span key={`${goal.name}-${index}`}><span className="scorer-ball" aria-hidden="true">&#9917;&#65038;</span>{name(goal.name)}{goal.minutes.length?` ${goal.minutes.join(", ")}`:""}{goal.tags.size?` ${Array.from(goal.tags).join(" ")}`:""}</span>)}</div>;
}
function Badge({name,logos,large=false}:{name:string;logos:Record<string,string>;large?:boolean}) {
  const [failed,setFailed] = useState(false);
  const src=logos[name];
  return <span className={"badge"+(large?" large":"")}>
    {src && !failed ? <img src={src} alt="" onError={()=>setFailed(true)} /> :
      <span>{name.split(" ").map(s=>s[0]).join("").slice(0,3).toUpperCase()}</span>}
  </span>;
}


function StadiumIcon({team,stadiums}:{team:string;stadiums:Record<string,string>}) {
  const [failed,setFailed]=useState(false);
  const src=stadiums[team];
  return <span className="stadium-icon" aria-hidden="true">
    {src&&!failed?<img src={src} alt="" width={40} height={40} loading="lazy" onError={()=>setFailed(true)}/>:<MapPin size={21}/>}
  </span>;
}

function Form({values}:{values:string[]}) {
  const {t}=useI18n();
  const title=(value:string)=>value==="W"?t("standings.win"):value==="D"?t("standings.draw"):t("standings.loss");
  const short=(value:string)=>value==="W"?t("standings.winShort"):value==="D"?t("standings.drawShort"):t("standings.lossShort");
  return <span className="form" aria-label={t("standings.form")}>{values.map((v,i)=><span key={i} className={v.toLowerCase()} title={title(v)}>{short(v)}</span>)}</span>;
}

function StandingsForm({matches,teamId,venue="all",locale="en"}:{matches:Match[];teamId:number;venue?:VenueFilter;locale?:Locale}) {
  const {t}=useI18n();
  const eligible=completed(matches)
    .filter(match=>(match.homeId===teamId||match.awayId===teamId) && (venue==="all" || (venue==="home" ? match.homeId===teamId : match.awayId===teamId)))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id)
    .slice(-5);
  const latest=eligible.reduce<Match|null>((current,match)=>!current||match.date.localeCompare(current.date)>0||(match.date===current.date&&match.id>current.id)?match:current,null);
  const resultText=(match:Match)=>{
    const home=match.homeId===teamId;
    const goalsFor=home?match.homeGoals!:match.awayGoals!;
    const goalsAgainst=home?match.awayGoals!:match.homeGoals!;
    return goalsFor>goalsAgainst?"W":goalsFor===goalsAgainst?"D":"L";
  };
  const resultLabel=(result:string)=>result==="W"?t("standings.win"):result==="D"?t("standings.draw"):t("standings.loss");
  return <span className="form standings-form" aria-label={t("standings.form")}>
    {eligible.map(match=>{
      const home=match.homeId===teamId;
      const opponent=home?match.away:match.home;
      const result=resultText(match);
      const score=`${match.homeGoals}–${match.awayGoals}`;
      const description=`${opponent} · ${displayDate(match.date,locale)} · ${home?"H":"A"} · ${score} · ${resultLabel(result)}`;
      const badge=<span className={`${result.toLowerCase()}${latest?.id===match.id?" latest": ""}`} title={description} aria-label={description}>{result}</span>;
      return match.historical
        ? <span key={match.id} className={`standings-form-item ${result.toLowerCase()}${latest?.id===match.id?" latest": ""}`}>{badge}</span>
        : <a key={match.id} className={`standings-form-item ${result.toLowerCase()}${latest?.id===match.id?" latest": ""}`} href={`/results/${match.id}`} aria-label={description} onClick={event=>event.stopPropagation()}>{badge}</a>;
    })}
  </span>;
}

function DevelopmentPage({title}:{title:string}) {
  return <section className="panel development-page"><span className="eyebrow">IN DEVELOPMENT</span><h2>{title}</h2><p>This section is being developed.</p></section>;
}

function TrendChart({matches,venue="all"}:{matches:Match[];venue?:VenueFilter}) {
  const {t}=useI18n();
  const trend=goalTrend(matches,venue), max=Math.max(4,...trend.map(t=>t.average));
  if (!trend.length) return <p className="empty">{t("dash.noCompletedMatches")}</p>;
  const points=trend.map((t,i)=>`${32+i*596/Math.max(1,trend.length-1)},${175-t.average/max*140}`).join(" ");
  return <div className="trend-chart">
    <svg viewBox="0 0 660 214" role="img" aria-label={`${t("dash.metric.goals")} ${String.fromCharCode(8211)} ${t("dash.matchday")}`}>
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
      {[0,1,2,3,4].map(i=><g key={i}><line x1="32" x2="628" y1={175-i*35} y2={175-i*35} stroke="#465360" strokeDasharray="3 5"/><text x="8" y={179-i*35} fill="#a9b8c5" fontSize="10">{(i*max/4).toFixed(0)}</text></g>)}
      {trend.length>1&&<polygon points={`32,175 ${points} 628,175`} fill="url(#chartFill)"/>}
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round"/>
      {trend.map((point,i)=><g key={point.week}><circle cx={32+i*596/Math.max(1,trend.length-1)} cy={175-point.average/max*140} r="3" fill="#29323c" stroke="var(--accent)" strokeWidth="2"><title>{t("dash.matchdayLabel",{number:point.week})}: {point.average.toFixed(2)} · {t("dash.metric.goals")} · {point.played===1?t("dash.tooltipMatches.one",{count:point.played}):t("dash.tooltipMatches.other",{count:point.played})}</title></circle>{(i%Math.max(1,Math.ceil(trend.length/9))===0 || i===trend.length-1) && <text x={32+i*596/Math.max(1,trend.length-1)} y="201" textAnchor="middle" fill="#a9b8c5" fontSize="10">{point.week}</text>}</g>)}
    </svg>
    <div className="chart-caption"><span>{t("dash.metric.goals")}</span><span>{t("dash.matchday")}</span></div>
  </div>;
}

function LeagueTrendChart({points,label,percentValue}:{points:{week:number;played:number;scheduled:number;value:number|null}[];label:string;percentValue?:boolean}) {
  const {t}=useI18n();
  const values=points.map(point=>point.value).filter((value):value is number=>value!==null);
  if (!values.length) return <p className="empty">{t("dash.noCompletedMatches")}</p>;
  const observedMin=Math.min(...values), observedMax=Math.max(...values);
  const observedRange=Math.max(.01,observedMax-observedMin);
  const padding=Math.max(observedRange*.15,percentValue?1:.15);
  const min=Math.max(0,observedMin-padding);
  const max=percentValue?Math.min(100,observedMax+padding):observedMax+padding;
  const range=Math.max(.01,max-min);
  const pointsString=points.map((point,index)=>`${54+index*1218/Math.max(1,points.length-1)},${250-((point.value??min)-min)/range*200}`).join(" ");
  const tooltipCount=(count:number)=>count===1?t("dash.tooltipMatches.one",{count}):t("dash.tooltipMatches.other",{count});
  return <div className="trend-chart"><svg viewBox="0 0 1300 300" role="img" aria-label={`${label} ${String.fromCharCode(8211)} ${t("dash.matchday")}`}>
    {[0,1,2,3,4].map(index=><g key={index}><line x1="54" x2="1272" y1={250-index*50} y2={250-index*50} stroke="#465360" strokeDasharray="3 5"/><text x="18" y={254-index*50} fill="#a9b8c5" fontSize="10">{(min+index*range/4).toFixed(percentValue?0:1)}{percentValue?"%":""}</text></g>)}
    <polyline points={pointsString} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round"/>
    {points.map((point,index)=><g key={point.week}><circle cx={32+index*596/Math.max(1,points.length-1)} cy={175-((point.value??min)-min)/range*140} r="3" fill="#29323c" stroke="var(--accent)" strokeWidth="2"><title>{t("dash.matchdayLabel",{number:point.week})}: {point.value===null?t("dash.tooltipUnavailable"):point.value.toFixed(percentValue?1:2)+(percentValue?"%":"")} · {label} · {tooltipCount(point.played)}{point.scheduled?` · ${t("dash.tooltipStillToPlay",{count:point.scheduled})}`:""}</title></circle>{(index%Math.max(1,Math.ceil(points.length/9))===0||index===points.length-1)&&<text x={32+index*596/Math.max(1,points.length-1)} y="201" textAnchor="middle" fill="#a9b8c5" fontSize="10">{point.week}</text>}</g>)}
  </svg><div className="chart-caption"><span>{label}</span><span>{t("dash.matchday")}</span></div></div>;
}


function matchdayDates(matches:Match[],locale:Locale="en") {
  const dates=matches.map(m=>m.date).filter(Boolean).sort();
  if (!dates.length) return "Dates unavailable";
  const first=displayDate(dates[0],locale),last=displayDate(dates[dates.length-1],locale);
  return first===last?first:first+" "+String.fromCharCode(0x2013)+" "+last;
}

type TrendExtreme = { matches: Match[]; value: number; match: Match; ties: number };
type TrendPointWithExtremes = LeagueTrendPoint & { highest: TrendExtreme | null; lowest: TrendExtreme | null };

function monotoneTrendPath(points:TrendPointWithExtremes[],x:(index:number)=>number,y:(value:number|null)=>number) {
  const path:string[]=[];
  let segment:{index:number;value:number}[]=[];
  const flush=()=>{
    if(!segment.length)return;
    if(segment.length===1){path.push(`M ${x(segment[0].index)} ${y(segment[0].value)}`);segment=[];return;}
    const slopes=segment.slice(0,-1).map((point,index)=>{
      const next=segment[index+1];
      return (y(next.value)-y(point.value))/(x(next.index)-x(point.index));
    });
    const tangents=segment.map((_,index)=>index===0?slopes[0]:index===segment.length-1?slopes[slopes.length-1]:(slopes[index-1]+slopes[index])/2);
    for(let index=0;index<slopes.length;index++){
      if(slopes[index]===0){tangents[index]=0;tangents[index+1]=0;continue;}
      if(Math.sign(tangents[index])!==Math.sign(slopes[index]))tangents[index]=0;
      if(Math.sign(tangents[index+1])!==Math.sign(slopes[index]))tangents[index+1]=0;
      const limit=3*Math.abs(slopes[index]);
      tangents[index]=Math.sign(tangents[index])*Math.min(Math.abs(tangents[index]),limit);
      tangents[index+1]=Math.sign(tangents[index+1])*Math.min(Math.abs(tangents[index+1]),limit);
    }
    path.push(`M ${x(segment[0].index)} ${y(segment[0].value)}`);
    for(let index=0;index<slopes.length;index++){
      const current=segment[index],next=segment[index+1],dx=(x(next.index)-x(current.index))/3;
      path.push(`C ${x(current.index)+dx} ${y(current.value)+tangents[index]*dx}, ${x(next.index)-dx} ${y(next.value)-tangents[index+1]*dx}, ${x(next.index)} ${y(next.value)}`);
    }
    segment=[];
  };
  points.forEach((point,index)=>{if(point.value===null){flush();return;}segment.push({index,value:point.value});if(index===points.length-1)flush();});
  return path.join(" ");
}

function LeagueTrendChartBalanced({points,label,percentValue}:{points:TrendPointWithExtremes[];label:string;percentValue?:boolean}) {
  const {t}=useI18n();
  const [hoveredWeek,setHoveredWeek]=useState<number|null>(null);
  const values=points.map(point=>point.value).filter((value):value is number=>value!==null);
  if(!values.length)return <p className="empty">{t("dash.noCompletedMatches")}</p>;
  const observedMin=Math.min(...values),observedMax=Math.max(...values),observedRange=Math.max(.01,observedMax-observedMin),padding=Math.max(observedRange*.15,percentValue?1:.15),min=Math.max(0,observedMin-padding),max=percentValue?Math.min(100,observedMax+padding):observedMax+padding,range=Math.max(.01,max-min);
  const x=(index:number)=>54+index*1218/Math.max(1,points.length-1),y=(value:number|null)=>250-((value??min)-min)/range*200;
  const tooltipCount=(count:number)=>count===1?t("dash.tooltipMatches.one",{count}):t("dash.tooltipMatches.other",{count});
  const hoveredIndex=hoveredWeek===null?-1:points.findIndex(point=>point.week===hoveredWeek),hovered=hoveredIndex>=0?points[hoveredIndex]:null;
  const formatValue=(value:number)=>`${value.toFixed(percentValue?1:2)}${percentValue?"%":""}`;
  const tooltipSide=hoveredIndex>=0&&hoveredIndex<points.length*.2?"left":hoveredIndex>=points.length*.8?"right":"center";
  const extreme=(title:string,item:TrendExtreme|null)=><div className="overview-trend-extreme"><span>{title}</span>{item?<><strong>{item.match.home} {item.match.homeGoals}–{item.match.awayGoals} {item.match.away}</strong><b>{formatValue(item.value)}{item.ties>1?` · ${item.ties} tied`:""}</b></>:<em>{t("dash.tooltipUnavailable")}</em>}</div>;
  return <div className="trend-chart"><svg viewBox="0 0 1300 300" role="img" aria-label={`${label} ${String.fromCharCode(8211)} ${t("dash.matchday")}`}>
    {[0,1,2,3,4].map(index=><g key={index}><line x1="54" x2="1272" y1={250-index*50} y2={250-index*50}/><text x="18" y={254-index*50}>{(min+index*range/4).toFixed(percentValue?0:1)}{percentValue?"%":""}</text></g>)}
    <path d={monotoneTrendPath(points,x,y)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
    {points.map((point,index)=><g key={point.week}><circle cx={x(index)} cy={y(point.value)} r="3.5" fill="#fff" stroke="var(--accent)" strokeWidth="1.5"><title>{t("dash.matchdayLabel",{number:point.week})}: {point.value===null?t("dash.tooltipUnavailable"):point.value.toFixed(percentValue?1:2)+(percentValue?"%":"")} · {label} · {tooltipCount(point.played)}{point.scheduled?` · ${t("dash.tooltipStillToPlay",{count:point.scheduled})}`:""}</title></circle>{(index%Math.max(1,Math.ceil(points.length/9))===0||index===points.length-1)&&<text x={x(index)} y="282" textAnchor="middle">{point.week}</text>}</g>)}
  </svg><div className="chart-caption"><span>{label}</span><span>{t("dash.matchday")}</span></div></div>;
}

function LeagueTrendChartWithExtremes({points,label,percentValue}:{points:TrendPointWithExtremes[];label:string;percentValue?:boolean}) {
  const {t}=useI18n();
  const [hoveredWeek,setHoveredWeek]=useState<number|null>(null);
  const values=points.map(point=>point.value).filter((value):value is number=>value!==null);
  if(!values.length)return <p className="empty">{t("dash.noCompletedMatches")}</p>;
  const observedMin=Math.min(...values),observedMax=Math.max(...values),padding=Math.max((observedMax-observedMin)*.15,percentValue?1:.15),min=Math.max(0,observedMin-padding),max=percentValue?Math.min(100,observedMax+padding):observedMax+padding,range=Math.max(.01,max-min);
  const x=(index:number)=>54+index*1218/Math.max(1,points.length-1),y=(value:number|null)=>250-((value??min)-min)/range*200;
  const formatAverage=(value:number)=>`${value.toFixed(percentValue?1:2)}${percentValue?"%":""}`;
  const formatMatchValue=(value:number)=>`${Number.isInteger(value)?value:value.toFixed(2)}${percentValue?"%":""}`;
  const hoveredIndex=hoveredWeek===null?-1:points.findIndex(point=>point.week===hoveredWeek),hovered=hoveredIndex>=0?points[hoveredIndex]:null;
  const side=hoveredIndex>=0&&hoveredIndex<points.length*.2?"left":hoveredIndex>=points.length*.8?"right":"center";
  const extreme=(title:string,item:TrendExtreme|null,distinct=true)=><div className="overview-trend-extreme"><span>{title}</span>{item?<><strong>{item.match.home} {item.match.homeGoals}–{item.match.awayGoals} {item.match.away}</strong><b>{formatMatchValue(item.value)}{item.ties>1?` · ${item.ties} tied`:!distinct?` · ${t("dash.noDistinctExtreme")}`:""}</b></>:<em>{t("dash.tooltipUnavailable")}</em>}</div>;
  return <div className="trend-chart"><svg viewBox="0 0 1300 300" role="img" aria-label={`${label} ${String.fromCharCode(8211)} ${t("dash.matchday")}`}>
    {[0,1,2,3,4].map(index=><g key={index}><line x1="54" x2="1272" y1={250-index*50} y2={250-index*50}/><text x="18" y={254-index*50}>{(min+index*range/4).toFixed(percentValue?0:1)}{percentValue?"%":""}</text></g>)}
    <path d={monotoneTrendPath(points,x,y)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
    {points.map((point,index)=><g key={point.week}><circle cx={x(index)} cy={y(point.value)} r="3.5" fill="#fff" stroke="var(--accent)" strokeWidth="1.5"/><circle className="overview-trend-hit" cx={x(index)} cy={y(point.value)} r="10" fill="transparent" stroke="none" tabIndex={0} aria-label={t("dash.matchdayLabel",{number:point.week})} onMouseEnter={()=>setHoveredWeek(point.week)} onMouseLeave={()=>setHoveredWeek(null)} onFocus={()=>setHoveredWeek(point.week)} onBlur={()=>setHoveredWeek(null)}/>{(index%Math.max(1,Math.ceil(points.length/9))===0||index===points.length-1)&&<text x={x(index)} y="282" textAnchor="middle">{point.week}</text>}</g>)}
  </svg>{hovered&&<div className={`overview-trend-tooltip ${side}`}><strong>{t("dash.matchdayLabel",{number:hovered.week})}</strong><span className="overview-trend-average">{label}: <b>{hovered.value===null?t("dash.tooltipUnavailable"):formatAverage(hovered.value)}</b></span>{hovered.highest?.match.id===hovered.lowest?.match.id?extreme(`${t("dash.highest")} / ${t("dash.lowest")}`,hovered.highest,false):<>{extreme(t("dash.highest"),hovered.highest)}{extreme(t("dash.lowest"),hovered.lowest)}</>}</div>}<div className="chart-caption"><span>{label}</span><span>{t("dash.matchday")}</span></div></div>;
}

function LeagueTrendChartAllExtremes({points,label,percentValue}:{points:TrendPointWithExtremes[];label:string;percentValue?:boolean}) {
  const {t}=useI18n();
  const [hoveredWeek,setHoveredWeek]=useState<number|null>(null);
  const values=points.map(point=>point.value).filter((value):value is number=>value!==null);
  if(!values.length)return <p className="empty">{t("dash.noCompletedMatches")}</p>;
  const observedMin=Math.min(...values),observedMax=Math.max(...values),padding=Math.max((observedMax-observedMin)*.15,percentValue?1:.15),min=Math.max(0,observedMin-padding),max=percentValue?Math.min(100,observedMax+padding):observedMax+padding,range=Math.max(.01,max-min);
  const x=(index:number)=>54+index*1218/Math.max(1,points.length-1),y=(value:number|null)=>250-((value??min)-min)/range*200;
  const formatAverage=(value:number)=>`${value.toFixed(percentValue?1:2)}${percentValue?"%":""}`;
  const formatMatchValue=(value:number)=>`${Number.isInteger(value)?value:value.toFixed(2)}${percentValue?"%":""}`;
  const hoveredIndex=hoveredWeek===null?-1:points.findIndex(point=>point.week===hoveredWeek),hovered=hoveredIndex>=0?points[hoveredIndex]:null;
  const side=hoveredIndex>=0&&hoveredIndex<points.length*.2?"left":hoveredIndex>=points.length*.8?"right":"center";
  const previousValue=hoveredIndex>0?points[hoveredIndex-1].value:null;
  const previousWeek=hoveredIndex>0?points[hoveredIndex-1].week:null;
  const change=hovered?.value!==null&&hovered?.value!==undefined&&previousValue!==null&&previousValue!==undefined?hovered.value-previousValue:null;
  const changeText=change===null?null:`${change>0?"+":""}${change.toFixed(percentValue?1:2)}${percentValue?"%":""}`;
  const changeIcon=change===null?null:change>0?<TrendingUp width={16} height={16}/>:change<0?<TrendingDown width={16} height={16}/>:<Minus width={16} height={16}/>;
  const changeDirection=change===null?"flat":change>0?"up":change<0?"down":"flat";
  const section=(kind:"highest"|"lowest",title:string,item:TrendExtreme|null)=><section className={`overview-trend-extreme ${kind}`}><span>{title}{item?` · ${formatMatchValue(item.value)}`:""}</span>{item?<div className="overview-trend-matches">{item.matches.map(match=><div className="overview-trend-match" key={match.id}><span>{match.home}</span><b>{match.homeGoals}–{match.awayGoals}</b><span>{match.away}</span></div>)}</div>:<em>{t("dash.tooltipUnavailable")}</em>}</section>;
  const allTied=Boolean(hovered?.highest&&hovered.lowest&&hovered.highest.value===hovered.lowest.value);
  return <div className="trend-chart"><svg viewBox="0 0 1300 300" role="img" aria-label={`${label} ${String.fromCharCode(8211)} ${t("dash.matchday")}`}>
    {[0,1,2,3,4].map(index=><g key={index}><line x1="54" x2="1272" y1={250-index*50} y2={250-index*50}/><text fill="var(--muted)" x="18" y={254-index*50}>{(min+index*range/4).toFixed(percentValue?0:1)}{percentValue?"%":""}</text></g>)}
    <path d={monotoneTrendPath(points,x,y)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
    {points.map((point,index)=><g key={point.week}><circle cx={x(index)} cy={y(point.value)} r="3" fill="#fff" stroke="var(--accent)" strokeWidth="1.5"/><circle className="overview-trend-hit" cx={x(index)} cy={y(point.value)} r="10" fill="transparent" stroke="none" tabIndex={0} aria-label={t("dash.matchdayLabel",{number:point.week})} onMouseEnter={()=>setHoveredWeek(point.week)} onMouseLeave={()=>setHoveredWeek(null)} onFocus={()=>setHoveredWeek(point.week)} onBlur={()=>setHoveredWeek(null)}/>{(index%Math.max(1,Math.ceil(points.length/9))===0||index===points.length-1)&&<text fill="var(--muted)" x={x(index)} y="282" textAnchor="middle">{point.week}</text>}</g>)}
  </svg>{hovered&&<div className={`overview-trend-tooltip ${side}`}><strong>{t("dash.matchdayLabel",{number:hovered.week})}</strong><div className="overview-trend-header"><span className="overview-trend-average">{label}: <b>{hovered.value===null?t("dash.tooltipUnavailable"):formatAverage(hovered.value)}</b></span>{changeText!==null&&previousWeek!==null&&<span className={`overview-trend-change ${changeDirection}`}><span>{t("dash.vsMatchday",{number:previousWeek})}</span>{changeIcon}<b>{changeText}</b></span>}</div>{allTied?<section className="overview-trend-extreme highest"><span>{t("dash.allTied")}{hovered.highest?` · ${formatMatchValue(hovered.highest.value)}`:""}</span>{hovered.highest?<div className="overview-trend-matches">{hovered.highest.matches.map(match=><div className="overview-trend-match" key={match.id}><span>{match.home}</span><b>{match.homeGoals}–{match.awayGoals}</b><span>{match.away}</span></div>)}</div>:<em>{t("dash.tooltipUnavailable")}</em>}</section>:<>{section("highest",t("dash.highest"),hovered.highest)}{section("lowest",t("dash.lowest"),hovered.lowest)}</>}</div>}<div className="chart-caption"><span>{label}</span><span>{t("dash.matchday")}</span></div></div>;
}

function berlinDateKey(value:string) {
  const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Europe/Berlin"}).formatToParts(new Date(value));
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  return [get("year"),get("month"),get("day")].join("-");
}

function fixtureDateHeading(value:string,locale:Locale="en") {
  return new Intl.DateTimeFormat(({en:"en-GB",de:"de-DE",es:"es-ES",ro:"ro-RO"} as const)[locale],{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Berlin"}).format(new Date(value)).toUpperCase();
}

const kickoffTime = (date:string) => date ? new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(new Date(date))+" CET" : "Kick-off TBC";
const ordinal = (value:number) => value%100>=11&&value%100<=13?value+"th":value+(value%10===1?"st":value%10===2?"nd":value%10===3?"rd":"th");
const fixtureLabel = (match:Match) => match.status==="live"?"Live":match.status==="postponed"?"Postponed":match.status==="cancelled"?"Cancelled":match.status==="finished"?"Full time":"Scheduled";

function recentMatches(matches:Match[], teamId:number, before:string) {
  return matches.filter(m=>m.finished&&m.homeGoals!==null&&m.awayGoals!==null&&(m.homeId===teamId||m.awayId===teamId)&&m.date<before)
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
}

function PreviewResults({matches,teamId}:{matches:Match[];teamId:number}) {
  const {t}=useI18n();
  if(!matches.length)return <p className="preview-empty">No prior results in the imported archive.</p>;
    return <div className="preview-results">{matches.map(m=>{
    const home=m.homeId===teamId, goalsFor=home?m.homeGoals!:m.awayGoals!, goalsAgainst=home?m.awayGoals!:m.homeGoals!;
    const result=goalsFor>goalsAgainst?"W":goalsFor===goalsAgainst?"D":"L";
    const resultLabel=result==="W"?t("standings.winShort"):result==="D"?t("standings.drawShort"):t("standings.lossShort");
    const row=<div className="preview-result recent-form-result" key={m.id}><span className={"result-dot "+result.toLowerCase()}>{resultLabel}</span><span>{displayDate(m.date)}</span><strong>{home?m.away:m.home}</strong><small className="venue-side" title={home?"Home":"Away"}>{home?"H":"A"}</small><b>{goalsFor} &ndash; {goalsAgainst}</b></div>;
    return m.historical?<Fragment key={m.id}>{row}</Fragment>:<a className="recent-form-link" href={`/results/${m.id}`} key={m.id} aria-label={`${m.home} ${goalsFor}–${goalsAgainst} ${m.away}`}>{row}</a>;
  })}</div>;
}

type PreviewReference = { max:number|null; homeRank:number|null; awayRank:number|null; total:number };
function PreviewComparisonBars({rows,homeName,awayName,reference,context}:{rows:ReturnType<typeof previewMetrics>;homeName:string;awayName:string;reference:Map<string,PreviewReference>;context:string}) {
  const format=(value:number|null,percentValue?:boolean)=>value===null?"?":percentValue?percent(value*100):value.toFixed(1);
  return <div className="preview-comparison-bars">
    <div className="preview-comparison-head"><strong>{homeName}</strong><span aria-hidden="true"/><strong>{awayName}</strong></div>
    {rows.map(row=>{const homeValue=row.home,awayValue=row.away,ref=reference.get(row.label),max=ref?.max??Math.max(homeValue??0,awayValue??0);const compactLabel=row.label.replace(/ per match$/i,"");const rank=ref?.homeRank&&ref.awayRank?`League ranking: ${ref.homeRank}/${ref.total} home · ${ref.awayRank}/${ref.total} away`:"League ranking unavailable";return <div className="preview-comparison-row" key={row.label}>
      <b>{format(homeValue,row.percent)}</b>
      <div className="preview-comparison-center" title={rank}><span>{compactLabel}</span><div className="preview-comparison-track"><i className="home" style={{width:max&&homeValue!==null?`${homeValue/max*100}%`:"0%"}}/><i className="away" style={{width:max&&awayValue!==null?`${awayValue/max*100}%`:"0%"}}/></div></div>
      <b>{format(awayValue,row.percent)}</b>
    </div>;})}
  </div>;
}

function StatisticsCategoryIcon({category}:{category:"attack"|"defense"|"passing"|"discipline"}) {
  const Icon=category==="attack"?Target:category==="defense"?Shield:category==="passing"?ArrowLeftRight:ClipboardList;
  return <Icon size={14} strokeWidth={1.8} aria-hidden="true"/>;
}
function StatisticsCategoryTabs({value,onChange}:{value:"attack"|"defense"|"passing"|"discipline";onChange:(value:"attack"|"defense"|"passing"|"discipline")=>void}) {
  const {t}=useI18n();
  return <div className="stat-category-tabs preview-category-tabs">{(["attack","defense","passing","discipline"] as const).map(category=><button key={category} className={value===category?"active":""} onClick={()=>onChange(category)}>{t(`ui.${category}Category`)}</button>)}</div>;
}
function StatisticsControls({lens,scope,onLensChange,onScopeChange}:{lens:"team"|"opponent";scope:"all"|"venue";onLensChange:(value:"team"|"opponent")=>void;onScopeChange:(value:"all"|"venue")=>void}) {
  const {t}=useI18n();
  return <><div className="preview-stat-controls"><div className="stats-lens"><button className={lens==="team"?"active":""} onClick={()=>onLensChange("team")}>{t("ui.team")}</button><button className={lens==="opponent"?"active":""} onClick={()=>onLensChange("opponent")}>{t("ui.opponent")}</button></div><div className="preview-tabs"><button className={scope==="all"?"active":""} onClick={()=>onScopeChange("all")}>{t("ui.season")}</button><button className={scope==="venue"?"active":""} onClick={()=>onScopeChange("venue")}>{t("ui.venue")}</button></div></div><div className="preview-stat-help"><span>{lens==="team"?t("ui.forHelp"):t("ui.againstHelp")}</span><span>{scope==="all"?t("ui.seasonHelp"):t("ui.venueHelp")}</span></div></>;
}

type HistoricalH2HResult = { id:number|string; reportId:number|null; season:string|null; date:string; homeId:number|null; awayId:number|null; home:string; away:string; homeGoals:number; awayGoals:number };
type HistoricalH2HData = { totalMeetings:number; homeWins:number; draws:number; awayWins:number; homeGoals:number; awayGoals:number; averageGoals:number; homeWinPercentage:number; awayWinPercentage:number; results:HistoricalH2HResult[]; pagination:{hasMore:boolean;total:number} };

function HistoricalHeadToHead({data,loading,error,expanded,onExpand,homeName,awayName,scope,onScopeChange}:{data:HistoricalH2HData|null;loading:boolean;error:string;expanded:boolean;onExpand:()=>void;homeName:string;awayName:string;scope:"all"|"venue";onScopeChange:(scope:"all"|"venue")=>void}) {
  const {locale,t}=useI18n();
  const total=(data?.homeWins??0)+(data?.draws??0)+(data?.awayWins??0);
  const homeWidth=total?((data?.homeWins??0)/total)*100:0, drawWidth=total?((data?.draws??0)/total)*100:0, awayWidth=total?((data?.awayWins??0)/total)*100:0;
  return <section className="h2h-history" aria-label={t("h2h.title")}>
    <div className="preview-title-row"><div><span className="eyebrow">{t("h2h.historical")}</span><h4>{t("h2h.title")}</h4></div><div className="preview-tabs h2h-scope-tabs"><button className={scope==="all"?"active":""} onClick={()=>onScopeChange("all")}>{t("h2h.allMeetings")}</button><button className={scope==="venue"?"active":""} onClick={()=>onScopeChange("venue")}>{t("h2h.atHome",{team:abbreviate(homeName)})}</button></div></div>
    {loading?<p className="preview-empty">{t("h2h.loading")}</p>:error?<p className="preview-empty">{error}</p>:!data||!data.totalMeetings?<p className="preview-empty">{t("h2h.empty")}</p>:<>
      <div className="h2h-record-grid"><div><strong>{data.homeWins}</strong><span><i className="h2h-color-dot home" aria-hidden="true"/>{homeName}</span></div><div><strong>{data.draws}</strong><span><i className="h2h-color-dot draw" aria-hidden="true"/>{t("h2h.draws")}</span></div><div><strong>{data.awayWins}</strong><span><i className="h2h-color-dot away" aria-hidden="true"/>{awayName}</span></div></div>
      <div className="h2h-record-bar"><span className="home" style={{width:`${homeWidth}%`}}/><span className="draw" style={{width:`${drawWidth}%`}}/><span className="away" style={{width:`${awayWidth}%`}}/></div>
      <div className="h2h-metrics"><div><strong>{data.totalMeetings}</strong><span>{t("h2h.meetings")}</span></div><div><strong>{data.homeGoals} – {data.awayGoals}</strong><span>{t("h2h.goals")}</span></div><div><strong>{data.averageGoals.toFixed(2)}</strong><span>{t("h2h.averageGoals")}</span></div><div><strong>{Math.round(data.homeWinPercentage)}% – {Math.round(data.awayWinPercentage)}%</strong><span>{t("h2h.winPercentage")}</span></div></div>
      <div className="h2h-results-heading"><h5>{t("h2h.previousMeetings")}</h5><span>{t("h2h.showing",{count:data.results.length,total:data.totalMeetings})}</span></div>
      <div className="preview-results h2h-history-results">{data.results.map(match=>{const row=<div className="preview-result h2h-row" key={match.id}><span>{displayDate(match.date,locale)}</span><strong>{match.home}</strong><b>{match.homeGoals} {String.fromCharCode(8211)} {match.awayGoals}</b><strong>{match.away}</strong></div>;return match.reportId!==null?<a className="h2h-report-link" href={`/results/${match.reportId}`} key={match.id} title={t("h2h.openReport")}>{row}</a>:row;})}</div>
      {data.pagination.hasMore||expanded?<button className="h2h-expand" onClick={onExpand}>{expanded?t("h2h.showFewer"):t("h2h.viewAll")}</button>:null}
    </>}
  </section>;
}

function PredictionPanel({prediction}:{prediction:MatchPrediction|null}) {
  const {t}=useI18n();
  if(!prediction || prediction.status!=="available") return <section className="prediction-empty" aria-label="Predictions">
    <span className="eyebrow">{t("ui.predictions").toUpperCase()}</span><h3>{t("ui.predictionsComingSoon")}</h3><p>{t("ui.predictionsDescription")}</p>
    <div className="prediction-ready"><section><h4>{t("ui.matchResult")}</h4><span>{t("ui.homeWin")} · {t("ui.draw")} · {t("ui.awayWin")}</span><i/></section><section><h4>{t("ui.goals")}</h4><span>{t("ui.xgTotalsBtts")}</span><i/></section><section><h4>{t("ui.corners")}</h4><span>{t("ui.expectedTotalOver")}</span><i/></section><section><h4>{t("ui.shots")}</h4><span>{t("ui.shotsOnTarget")}</span><i/></section></div>
  </section>;
  return null;
}

function CompletedMatchDetails({match,home,away,onAnalysis}:{match:Match;home:ReturnType<typeof statsForPeriod>;away:ReturnType<typeof statsForPeriod>;onAnalysis:()=>void}) {
  const {t}=useI18n();
  const rows=[
    {label:t("report.possession"),home:home?.possession,away:away?.possession,percent:true},
    {label:t("stats.metric.shots"),home:home?.shots,away:away?.shots},
    {label:t("stats.metric.shot_on_target"),home:home?.onTarget,away:away?.onTarget},
    {label:t("stats.metric.corners"),home:home?.corners,away:away?.corners},
    {label:t("stats.metric.yellow_card"),home:home?.yellowCards,away:away?.yellowCards},
    {label:t("stats.metric.red_card"),home:home?.redCards,away:away?.redCards}
  ];
  return <div className="completed-details"><MatchMomentum homeName={match.home} awayName={match.away}/><section className="main-match-stats">{rows.map(row=>{const available=row.home!==null&&row.home!==undefined&&row.away!==null&&row.away!==undefined;const total=(row.home??0)+(row.away??0);const value=(amount:number|null|undefined)=>amount===null||amount===undefined?"?":row.percent?percent(amount*100):amount.toFixed(0);return <div className="comparison" key={row.label}><div><strong>{value(row.home)}</strong><span>{row.label}</span><strong>{value(row.away)}</strong></div><div className="compare-track"><span style={{width:available&&total?`${(row.home??0)/total*100}%`:"50%",opacity:available?1:.15}}/><span style={{flex:1,opacity:available?1:.15}}/></div></div>})}</section><button className="full-analysis-link" onClick={onAnalysis}>{t("ui.viewFullAnalysis")} <ArrowRight size={15}/></button></div>;
}
function MatchDialog({match,data,period,onClose}:{match:Match;data:Data;period:MatchPeriod;onClose:()=>void}) {
  const {locale,t}=useI18n();
  const dialog=useRef<HTMLDialogElement>(null);
  const [panel,setPanel]=useState<"overview"|"predictions"|"statistics"|"intelligence">("overview");
  const [h2hScope,setH2hScope]=useState<"all"|"venue">("all");
  const [averageScope,setAverageScope]=useState<"all"|"venue">("all");
  const [statsCategory,setStatsCategory]=useState<"attack"|"defense"|"passing"|"discipline">("attack");
  const [statsLens,setStatsLens]=useState<"team"|"opponent">("team");
  const [h2hData,setH2hData]=useState<HistoricalH2HData|null>(null);
  const [h2hLoading,setH2hLoading]=useState(false);
  const [h2hError,setH2hError]=useState("");
  const [h2hExpanded,setH2hExpanded]=useState(false);
  const isFixture=!match.finished;
  useEffect(()=>{
    const d=dialog.current; d?.showModal();
    const prev=document.body.style.overflow; document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=prev;};
  },[]);
  useEffect(()=>{
    if(!isFixture)return;
    const controller=new AbortController();
    setH2hLoading(true); setH2hError("");
    fetch(`/api/matches/${match.id}/h2h?venue=${h2hScope==="venue"?"home":"all"}&limit=${h2hExpanded?1000:5}`,{signal:controller.signal,cache:"force-cache"})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??t("h2h.unavailable"));return body as HistoricalH2HData;})
      .then(body=>setH2hData(body))
      .catch(reason=>{if(reason.name!=="AbortError")setH2hError(reason.message);})
      .finally(()=>setH2hLoading(false));
    return()=>controller.abort();
  },[isFixture,match.id,h2hScope,h2hExpanded,t]);
  const home=statsForPeriod(data.stats.find(s=>s.gameId===match.id && s.teamId===match.homeId),period);
  const away=statsForPeriod(data.stats.find(s=>s.gameId===match.id && s.teamId===match.awayId),period);
  const rows=[
    {label:t("stats.metric.shots"),h:home?.shots,a:away?.shots,pct:false},
    {label:t("stats.metric.shot_on_target"),h:home?.onTarget,a:away?.onTarget,pct:false},
    {label:t("report.possession"),h:home?.possession,a:away?.possession,pct:true},
    {label:t("stats.metric.pass_attempt"),h:home?.passes,a:away?.passes,pct:false},
    {label:t("stats.metric.pass_completion_pct"),h:home?.passCompletion,a:away?.passCompletion,pct:true}
  ];
  const archive=data.historicalMatches;
  const homeRecent=isFixture?recentMatches(archive,match.homeId,match.date):[];
  const awayRecent=isFixture?recentMatches(archive,match.awayId,match.date):[];
  const statisticsOptions:{lens:"for"|"against";venue:VenueFilter;period:MatchPeriod;before:string}={lens:statsLens==="team"?"for":"against",venue:(averageScope==="venue"?"home":"all") as VenueFilter,period,before:match.date};
  const homeAverage=aggregatePreviewStatistics(data.matches,data.stats,match.homeId,statisticsOptions);
  const awayAverage=aggregatePreviewStatistics(data.matches,data.stats,match.awayId,{...statisticsOptions,venue:averageScope==="venue"?"away":"all"});
  const statisticsRows=previewMetrics(homeAverage,awayAverage,statsCategory);
  const leagueReference=useMemo(()=>{
    const roleVenue=(role:"home"|"away")=>averageScope==="venue"?role:"all" as VenueFilter;
    const build=(role:"home"|"away")=>data.teams.map(team=>previewMetrics(
      aggregatePreviewStatistics(data.matches,data.stats,team.id,{...statisticsOptions,venue:roleVenue(role)}),
      aggregatePreviewStatistics(data.matches,data.stats,team.id,{...statisticsOptions,venue:roleVenue(role)}),statsCategory)
    );
    const homeLeague=build("home"),awayLeague=build("away"),reference=new Map<string,PreviewReference>();
    statisticsRows.forEach(row=>{
      const homeValues=homeLeague.map(rows=>rows.find(item=>item.label===row.label)?.home).filter((value):value is number=>typeof value==="number");
      const awayValues=awayLeague.map(rows=>rows.find(item=>item.label===row.label)?.home).filter((value):value is number=>typeof value==="number");
      const values=[...homeValues,...awayValues], max=values.length?Math.max(...values):null, lowerBetter=/conceded|fouls|card/i.test(row.label);
      const rank=(value:number|null,group:number[])=>{if(value===null||!group.length)return null;const sorted=[...group].sort((a,b)=>lowerBetter?a-b:b-a);return sorted.findIndex(item=>item===value)+1;};
      reference.set(row.label,{max,homeRank:rank(row.home,homeValues),awayRank:rank(row.away,awayValues),total:Math.max(homeValues.length,awayValues.length)});
    });
    return reference;
  },[averageScope,data,period,match.date,statisticsOptions,statsCategory,statisticsRows]);
  const homeDisplayName=data.fullTeamNames?.[match.home] ?? match.home;
  const awayDisplayName=data.fullTeamNames?.[match.away] ?? match.away;
  return <dialog ref={dialog} className="match-dialog" onCancel={onClose}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-labelledby="match-title">
    <div className="dialog-top"><span className="eyebrow">{isFixture?t("ui.matchPreview"):t("ui.matchReport")}   ·   {t("ui.matchday")} {match.week}{data.season?` - ${t("ui.season")} ${displaySeason(data.season)}`:""}</span><button className="icon-button" onClick={onClose} aria-label={t("ui.close")}><X size={20}/></button></div>
    <h2 id="match-title" className="sr-only">{match.home} versus {match.away}</h2>
    {match.finished&&<p className="match-date">{displayDate(match.date,locale)}</p>}
    {match.finished&&<p className="match-kickoff">{t("ui.kickoff")} {kickoffTime(match.date)}</p>}
    <div className="scoreboard">
      <div><Badge name={match.home} logos={data.logos} large/><h3>{homeDisplayName}</h3><OverviewScorers goals={data.goalscorers[String(match.id)]??[]} teamId={match.homeId}/></div>
      <div className="score"><strong>{match.finished?<>{match.homeGoals ?? "?"} <span>:</span> {match.awayGoals ?? "?"}</>:"vs"}</strong>{match.finished?<span className="pill">{period==="ft"?t("ui.fullTime").toUpperCase():rawPeriodLabel(period).toUpperCase()}</span>:<span className="fixture-kickoff">{displayDate(match.date,locale)}<b>{kickoffTime(match.date)}</b></span>}</div>
      <div><Badge name={match.away} logos={data.logos} large/><h3>{awayDisplayName}</h3><OverviewScorers goals={data.goalscorers[String(match.id)]??[]} teamId={match.awayId}/></div>
    </div>

    <div className="venue-inline" aria-label={t("ui.stadium")}>
      <StadiumIcon team={match.home} stadiums={data.stadiums}/>
      <strong>{match.venue||t("report.venueUnavailable")}</strong>
      {match.attendance!==null&&<span className="venue-attendance"><Users size={13}/>{match.attendance.toLocaleString("en-GB")}</span>}
    </div>
    {match.finished?<CompletedMatchDetails match={match} home={home} away={away} onAnalysis={()=>window.location.assign(`/results/${match.id}`)}/>:<>
    <nav className="dialog-tabs" aria-label={t("ui.fixturePreviewSections")}><button className={panel==="overview"?"active":""} onClick={()=>setPanel("overview")}><LayoutDashboard size={14}/>{t("nav.overview")}</button><button className={panel==="predictions"?"active":""} onClick={()=>setPanel("predictions")}><ChartNoAxesCombined size={14}/>{t("ui.predictions")}</button><button className={panel==="statistics"?"active":""} onClick={()=>setPanel("statistics")}><ChartNoAxesColumn size={14}/>{t("ui.statistics")}</button><button className={panel==="intelligence"?"active":""} onClick={()=>setPanel("intelligence")}><Sparkles size={14}/>{t("ui.intelligence")}</button></nav>
    {panel==="statistics"&&match.finished&&<><h3 className="section-subtitle">{period==="ft"?t("ui.fullTimeComparison"):rawPeriodLabel(period)+" · "+t("ui.comparison")}</h3>
    {rows.map(row=>{
      const available=row.h!=null && row.a!=null;
      const format=(v:number|null|undefined)=>v==null?"?":row.pct?percent(v*100):v.toLocaleString();
      const sum=(row.h??0)+(row.a??0);
      return <div className="comparison" key={row.label}>
        <div><strong>{format(row.h)}</strong><span>{row.label}</span><strong>{format(row.a)}</strong></div>
        <div className="compare-track"><span style={{width:(available && sum?row.h!/sum*100:50)+"%",opacity:available?1:.15}}/><span style={{flex:1,opacity:available?1:.15}}/></div>
      </div>;
    })}
    {(!home || !away) && <p className="data-note">Some team statistics have not been imported for this match.</p>}</>}
    {panel==="overview"&&isFixture&&<section className="fixture-preview" aria-label="Fixture preview">
      <div className="preview-heading"><span className="eyebrow">{t("ui.fixturePreview").toUpperCase()}</span><h3>{t("ui.recentFormContext")}</h3></div>
      <div className="form-preview-grid"><div><h4>{match.home}   ·   last 5</h4><PreviewResults matches={homeRecent} teamId={match.homeId}/></div><div><h4>{match.away}   ·   last 5</h4><PreviewResults matches={awayRecent} teamId={match.awayId}/></div></div>
      <HistoricalHeadToHead data={h2hData} loading={h2hLoading} error={h2hError} expanded={h2hExpanded} onExpand={()=>setH2hExpanded(value=>!value)} homeName={homeDisplayName} awayName={awayDisplayName} scope={h2hScope} onScopeChange={scope=>{setH2hScope(scope);setH2hExpanded(false);}}/>
    </section>}
    {panel==="statistics"&&<section className="fixture-preview statistics-preview" aria-label={t("ui.seasonStatistics")}><div className="preview-title-row"><div><h3>{statsLens==="team"?t("ui.teamAverages"):t("ui.opponentAverages")}</h3>{averageScope==="venue"&&<small className="stats-venue-note">{homeDisplayName} at home · {awayDisplayName} away</small>}</div><div className="preview-tabs"><button className={averageScope==="all"?"active":""} onClick={()=>setAverageScope("all")}>{t("ui.season")}</button><button className={averageScope==="venue"?"active":""} onClick={()=>setAverageScope("venue")}>{t("ui.venue")}</button></div></div><div className="stats-lens-row"><div className="stats-lens"><button className={statsLens==="team"?"active":""} onClick={()=>setStatsLens("team")}>{t("ui.team")}</button><button className={statsLens==="opponent"?"active":""} onClick={()=>setStatsLens("opponent")}>{t("ui.opponent")}</button></div><span className="stats-lens-note">{t("ui.forOutput")} · {t("ui.againstOutput")}</span></div><div className="stat-category-tabs"><button className={statsCategory==="attack"?"active":""} onClick={()=>setStatsCategory("attack")}>{t("ui.attackCategory")}</button><button className={statsCategory==="defense"?"active":""} onClick={()=>setStatsCategory("defense")}>{t("ui.defenseCategory")}</button><button className={statsCategory==="passing"?"active":""} onClick={()=>setStatsCategory("passing")}>{t("ui.passingCategory")}</button><button className={statsCategory==="discipline"?"active":""} onClick={()=>setStatsCategory("discipline")}>{t("ui.disciplineCategory")}</button></div><div className="average-grid"><strong>{match.home}</strong><span>{t("ui.metric")}</span><strong>{match.away}</strong>{statisticsRows.map(row=><Fragment key={row.label}><b>{typeof row.home==="number"?(row.percent?percent(row.home*100):row.home.toFixed(1)):"?"}</b><span>{row.label}</span><b>{typeof row.away==="number"?(row.percent?percent(row.away*100):row.away.toFixed(1)):"?"}</b></Fragment>)}</div></section>}
    {panel==="statistics"&&<><StatisticsControls lens={statsLens} scope={averageScope} onLensChange={setStatsLens} onScopeChange={setAverageScope}/><StatisticsCategoryTabs value={statsCategory} onChange={setStatsCategory}/><PreviewComparisonBars rows={statisticsRows} homeName={homeDisplayName} awayName={awayDisplayName} reference={leagueReference} context=""/></>} {panel==="predictions"&&<InsightsPlaceholder insightType="predictions" description="Future validated outputs: expected goals, outcome probabilities and scoreline probabilities."/>} {panel==="intelligence"&&(<InsightsPlaceholder insightType="match-preview" description="Future analysis of tactical strengths, weaknesses, playing styles and matchup-specific patterns."/>)}</>}
  </dialog>;
}

export default function Dashboard() {
  const {t,locale}=useI18n();
  const matchdayText=(number:number)=>t("dash.matchdayLabel",{number});
  const matchdayRangeText=(from:number,to:number)=>t("dash.matchdayRange",{from,to});
  const periodText=(value:MatchPeriod)=>t(`period.${value}`);
  const seasonPartText=(value:SeasonPart)=>value==="first"?t("dash.firstHalf"):value==="second"?t("dash.secondHalf"):t("dash.fullSeason");
  const venueText=(value:VenueFilter)=>value==="home"?t("dash.home"):value==="away"?t("dash.away"):t("dash.allVenues");
  const [data,setData]=useState<Data|null>(null);
  const dashboardCache=useRef(new Map<string,Data>());
  const [season,setSeason]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const router=useRouter();
  const pathname=usePathname();
  const isMatchReport=/^\/(results|matches)\/\d+$/.test(pathname);
  const teamAnalysisMatch = pathname.match(/^\/teams\/(\d+)$/);
  const teamAnalysisId = teamAnalysisMatch ? Number(teamAnalysisMatch[1]) : null;
  const view:View=pathname==="/goals" ? "goals" : pathname==="/matches" ? "results" : teamAnalysisId !== null ? "teamAnalysis" : allNavigation.find(item=>"/"+item.id===pathname)?.id??(isMatchReport?"results":"overview");
  // Only Results and Standings browse historical seasons. All other dashboard
  // views are always backed by the newest imported Bundesliga season.
  const seasonSelectable = view === "results" || view === "standings" || view === "teamAnalysis";
  const setView=(next:View)=>router.push("/"+next);
  const navigation=allNavigation;
  const [standingsFrom,setStandingsFrom]=useState(1);
  const [standingsTo,setStandingsTo]=useState(34);
  const [standingsFiltersOpen,setStandingsFiltersOpen]=useState(false);
  const previousView=useRef<View>(view);
  const [query,setQuery]=useState("");
  const [week,setWeek]=useState("");
  const loadedSeason=useRef("");
  const [selected,setSelected]=useState<Match|null>(null);
  const [revision,setRevision]=useState(0);
  const [teamId,setTeamId]=useState<number|null>(null);
  const [period,setPeriod]=useState<MatchPeriod>("ft");
  const [overviewMetric,setOverviewMetric]=useState<LeagueTrendMetric>("goals");
  const [seasonPart,setSeasonPart]=useState<SeasonPart>("all");
  const [venue,setVenue]=useState<VenueFilter>("all");
  const historyDataRequired=view==="history"||view==="teamAnalysis";
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");setSelected(null);
    const requestedSeason = seasonSelectable ? season : "";
    const cacheKey=`${requestedSeason||"latest"}:${historyDataRequired?"history-v3":"compact"}:${revision}`;
    const cached=dashboardCache.current.get(cacheKey);
    if(cached){
      setData(cached); setLoading(false);
      return ()=>controller.abort();
    }
    const params=new URLSearchParams();
    if(requestedSeason)params.set("season",requestedSeason);
    if(historyDataRequired){params.set("includeHistory","1");params.set("historyVersion","3");}
    fetch("/api/dashboard"+(params.size?`?${params.toString()}`:""),{signal:controller.signal,cache:"force-cache"})
      .then(async response=>{
        const body=await response.json();
        if(!response.ok)throw new Error(body.error??"Unable to load the dashboard.");
        return body as Data;
      }).then(body=>{
        const changed=loadedSeason.current!==body.season;
        loadedSeason.current=body.season;
        dashboardCache.current.set(cacheKey,body);
        setData(body);
        if(changed){
          const mode:FixtureMode=view==="upcoming"?"upcoming":"results";
          setWeek(String(defaultMatchday(body.matches,mode)??""));setTeamId(null);
        }else setTeamId(previous=>body.teams.some(t=>t.id===previous)?previous:null);
      })
      .catch(err=>{if(err.name!=="AbortError")setError(err.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[season,seasonSelectable,historyDataRequired,revision]);


  const effectiveMode:FixtureMode=view==="upcoming"?"upcoming":"results";
  // Demo mode: keep the final matchday of the current-season Upcoming view scheduled
  // so the page can be previewed without changing MongoDB or historical results.
  const demoUpcomingMatches=useMemo(()=>{
    const matches=data?.matches??[];
    if(view!=="upcoming"||!matches.length)return matches;
    const finalWeek=Math.max(...matches.map(match=>match.week));
    return matches.map(match=>match.week===finalWeek?{...match,finished:false,status:"scheduled" as const,homeGoals:null,awayGoals:null,attendance:null}:match);
  },[data,view]);
  const seasonMatchdayCount=useMemo(()=>Math.max(1,...(data?.matches??[]).map(match=>match.week).filter(week=>week>0)),[data]);
  const historicalSeason=Boolean(data?.matches.some(match=>match.historical));
  useEffect(()=>{
    setStandingsFrom(1);
    setStandingsTo(seasonMatchdayCount);
  },[data?.season,seasonMatchdayCount]);
  useEffect(()=>{ if (historicalSeason) setPeriod("ft"); },[historicalSeason]);
  const activePeriod: MatchPeriod = historicalSeason ? "ft" : period;
  // Upcoming is deliberately fixture-only: it must not inherit result filters.
  const phaseMatches=useMemo(()=>view==="upcoming"?demoUpcomingMatches:seasonSubset(data?.matches??[],seasonPart,seasonMatchdayCount),[data,seasonPart,view,demoUpcomingMatches,seasonMatchdayCount]);
  const scoredMatches=useMemo(()=>view==="upcoming"?phaseMatches:scoresForPeriod(phaseMatches,data?.stats??[],activePeriod),[phaseMatches,data,activePeriod,view]);
  const fixtureMatches=useMemo(()=>fixturesForMode(scoredMatches,effectiveMode),[scoredMatches,effectiveMode]);
  const roundMatches=useMemo(()=>week==="all"?fixtureMatches:fixtureMatches.filter(m=>m.week===Number(week)),[fixtureMatches,week]);
  const isTeamHistory=view==="results" && teamId!==null;
  const teamMatches=useMemo(()=>teamVenueMatches(roundMatches,teamId??-1,venue),[roundMatches,teamId,venue]);
  const tableMatches=useMemo(()=>view==="standings"?scoredMatches.filter(m=>m.week>=standingsFrom&&m.week<=standingsTo):scoredMatches,[view,scoredMatches,standingsFrom,standingsTo]);
  const scopeMatches=view==="standings"?tableMatches:isTeamHistory?teamMatches:roundMatches;
  const historyMatches=scoredMatches;
    const selectedSeasonConfig = data?.seasonConfigs?.find(config=>config.season===data.season);
    const pointsForWin= selectedSeasonConfig?.rules?.pointsForWin ?? 3;
    const pointsForDraw= selectedSeasonConfig?.rules?.pointsForDraw ?? 1;
    const standingsTiebreakers = selectedSeasonConfig?.standingsTiebreakers;
    const tableTeams=useMemo(()=>standings(tableMatches,venue,data?.matches??[],pointsForWin,standingsTiebreakers,pointsForDraw,selectedSeasonConfig),[tableMatches,venue,data,pointsForWin,pointsForDraw,standingsTiebreakers,selectedSeasonConfig]);
  const metricVenue=isTeamHistory?"all":venue;
  const summary=useMemo(()=>goalSummary(scopeMatches,metricVenue),[scopeMatches,metricVenue]);
  const finishedMatches=useMemo(()=>completed(scopeMatches),[scopeMatches]);
  const missingPeriod=scopeMatches.filter(m=>m.finished).length-finishedMatches.length;
  const homeRecord=useMemo(()=>finishedMatches.reduce((record,m)=>{
    const away=isTeamHistory?m.awayId===teamId:venue==="away";
    const goalsFor=away?m.awayGoals!:m.homeGoals!;
    const goalsAgainst=away?m.homeGoals!:m.awayGoals!;
    if(goalsFor>goalsAgainst)record.wins++;
    else if(goalsFor===goalsAgainst)record.draws++;
    else record.losses++;
    return record;
  },{wins:0,draws:0,losses:0}),[finishedMatches,isTeamHistory,teamId,venue]);
  const attendance=useMemo(()=>{
    const physical=scopeMatches.filter(m=>m.finished),reported=physical.filter(m=>m.attendance!==null);
    return {count:reported.length,matches:physical.length,average:reported.length?reported.reduce((sum,m)=>sum+m.attendance!,0)/reported.length:null};
  },[scopeMatches]);
  const distribution=useMemo(()=>[0,1,2,3,4,5].map(goals=>({
    label:goals===5?"5+":String(goals),
    count:finishedMatches.filter(m=>{
      const total=metricVenue==="home"?m.homeGoals!:metricVenue==="away"?m.awayGoals!:m.homeGoals!+m.awayGoals!;
      return goals===5?total>=5:total===goals;
    }).length
  })),[finishedMatches,metricVenue]);
  const weeks=useMemo(()=>[...new Set(fixtureMatches.map(m=>m.week).filter(w=>w>0))].sort((a,b)=>a-b),[fixtureMatches]);
  const preferredWeek=defaultMatchday(phaseMatches,effectiveMode);
  useEffect(()=>{
    const changed=previousView.current!==view;
    previousView.current=view;
    setSelected(null);
    const reset=changed&&(view==="upcoming"||(view==="results"&&teamId===null));
    setWeek(previous=>!reset&&(previous==="all"||weeks.includes(Number(previous)))?previous:String(preferredWeek??""));
  },[weeks,preferredWeek,view]);
  useEffect(()=>{
    if(data&&!loading&&view==="upcoming"&&!phaseMatches.some(m=>!m.finished))router.replace("/results");
  },[data,loading,view,router,phaseMatches]);
  const weekIndex=weeks.indexOf(Number(week));
  const filtered=useMemo(()=>scopeMatches.filter(m=>(m.home+" "+m.away).toLowerCase().includes(query.toLowerCase())),[scopeMatches,query]);
  const visible=filtered;
  const teams=tableTeams.filter(t=>t.name.toLowerCase().includes(query.toLowerCase()));
  const selectView=(next:View)=>{
    setQuery("");setTeamId(null);
    if(next==="results"||next==="upcoming")setWeek(String(defaultMatchday(phaseMatches,next==="upcoming"?"upcoming":"results")??""));
    setView(next);
  };
  const selectedTeam=tableTeams.find(t=>t.id===teamId);
  const ranked=[...tableTeams].filter(t=>t.played>0).sort((a,b)=>b.gf/b.played-a.gf/a.played).slice(0,5);
  const overviewCompleted=useMemo(()=>completed(data?.matches??[]),[data]);
  const latestCompletedWeek=useMemo(()=>Math.max(0,...overviewCompleted.map(match=>match.week)),[overviewCompleted]);
  const overviewResults=useMemo(()=>overviewCompleted.filter(match=>match.week===latestCompletedWeek).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id),[overviewCompleted,latestCompletedWeek]);
  const overviewScheduled=useMemo(()=>(data?.matches??[]).filter(match=>match.week===latestCompletedWeek).length-overviewResults.length,[data,latestCompletedWeek,overviewResults]);
  const overviewSummary=useMemo(()=>{
    const goals=overviewResults.reduce((sum,match)=>sum+(match.homeGoals??0)+(match.awayGoals??0),0);
    const attendance=overviewResults.filter(match=>typeof match.attendance==="number");
    const homeResults=overviewResults.reduce((result,match)=>{
      if((match.homeGoals??0)>(match.awayGoals??0))result.won++;
      else if((match.homeGoals??0)===(match.awayGoals??0))result.drawn++;
      else result.lost++;
      return result;
    },{won:0,drawn:0,lost:0});
    const attendanceTotal=attendance.reduce((sum,match)=>sum+(match.attendance??0),0);
    return {goals,attendanceAverage:attendance.length?attendanceTotal/attendance.length:null,attendanceReported:attendance.length,homeResults};
  },[overviewResults]);
    const overviewTable=useMemo(()=>standings(overviewCompleted,"all",data?.matches??[],pointsForWin,standingsTiebreakers,pointsForDraw,selectedSeasonConfig),[overviewCompleted,data,pointsForWin,pointsForDraw,standingsTiebreakers,selectedSeasonConfig]);
  const overviewTrend=useMemo(()=>leagueTrend(data?.matches??[],data?.stats??[],overviewMetric),[data,overviewMetric]);
  const overviewTrendWithExtremes=useMemo<TrendPointWithExtremes[]>(()=>{
    const statsByGameTeam=new Map((data?.stats??[]).map(row=>[`${row.gameId}:${row.teamId}`,row]));
    const grouped=new Map<number,TrendExtreme[]>();
    const matchValue=(match:Match):number|null=>{
      if(overviewMetric==="goals")return (match.homeGoals??0)+(match.awayGoals??0);
      const home=statsByGameTeam.get(`${match.id}:${match.homeId}`)?.periods?.ft,away=statsByGameTeam.get(`${match.id}:${match.awayId}`)?.periods?.ft;
      const values=overviewMetric==="shots"?[home?.shots,away?.shots]:overviewMetric==="shotsOnTarget"?[home?.onTarget,away?.onTarget]:overviewMetric==="corners"?[home?.corners,away?.corners]:overviewMetric==="yellowCards"?[home?.yellowCards,away?.yellowCards]:[home?.foulsCommitted,away?.foulsCommitted];
      return values.every(value=>typeof value==="number")?(values as number[]).reduce((sum,value)=>sum+value,0):null;
    };
    for(const match of overviewCompleted){const value=matchValue(match);if(value===null)continue;const list=grouped.get(match.week)??[];list.push({match,matches:[match],value,ties:1});grouped.set(match.week,list);}
    return overviewTrend.map(point=>{const list=[...(grouped.get(point.week)??[])].sort((a,b)=>a.value-b.value||a.match.date.localeCompare(b.match.date)||a.match.id-b.match.id);if(!list.length)return {...point,highest:null,lowest:null};const lowestValue=list[0].value,highestValue=list[list.length-1].value;const lowestMatches=list.filter(item=>item.value===lowestValue).map(item=>item.match),highestMatches=list.filter(item=>item.value===highestValue).map(item=>item.match);return {...point,lowest:{value:lowestValue,matches:lowestMatches,match:lowestMatches[0],ties:lowestMatches.length},highest:{value:highestValue,matches:highestMatches,match:highestMatches[0],ties:highestMatches.length}};});
  },[data,overviewCompleted,overviewMetric,overviewTrend]);
  const overviewTrendSummary=useMemo(()=>{
    const rows=new Map((data?.stats??[]).map(row=>[`${row.gameId}:${row.teamId}`,row]));
    let numerator=0,denominator=0,eligible=0;
    for(const fixture of overviewCompleted){
      if(overviewMetric==="goals"){
        numerator+=fixture.homeGoals!+fixture.awayGoals!; eligible++;
        continue;
      }
      const home=rows.get(`${fixture.id}:${fixture.homeId}`)?.periods?.ft;
      const away=rows.get(`${fixture.id}:${fixture.awayId}`)?.periods?.ft;
      const values=overviewMetric==="shots"?[home?.shots,away?.shots]:overviewMetric==="shotsOnTarget"?[home?.onTarget,away?.onTarget]:overviewMetric==="corners"?[home?.corners,away?.corners]:overviewMetric==="yellowCards"?[home?.yellowCards,away?.yellowCards]:overviewMetric==="fouls"?[home?.foulsCommitted,away?.foulsCommitted]:[home?.completedPasses,away?.completedPasses];
      if(values.some(value=>typeof value!=="number"))continue;
      const numericValues=values as number[];
      if(overviewMetric==="passCompletion"){
        const attempts=[home?.passes,away?.passes];
        if(attempts.some(value=>typeof value!=="number"))continue;
        numerator+=numericValues.reduce((sum,value)=>sum+value,0);
        denominator+=(attempts as number[]).reduce((sum,value)=>sum+value,0);
      }else numerator+=numericValues.reduce((sum,value)=>sum+value,0);
      eligible++;
    }
    return {average:overviewMetric==="passCompletion"?(denominator>0?numerator/denominator*100:null):(eligible>0?numerator/eligible:null),latest:overviewTrend.at(-1)?.value??null};
  },[data,overviewCompleted,overviewMetric,overviewTrend]);


  function renderResults() {
    const showMatchdayHeaders=view==="results" && week==="all" && !isTeamHistory;
    const dateGroups = view==="results" ? Array.from(visible.reduce((groups,match)=>{
      const key=berlinDateKey(match.date);
      const group=groups.get(key)??[];
      group.push(match); groups.set(key,group); return groups;
    },new Map<string,Match[]>()).entries()).sort(([a],[b])=>a.localeCompare(b)).map(([key,matches])=>({key,matches:matches.sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime())})) : [{key:"",matches:visible}];
    const renderFixture=(m:Match,showRowMatchday=false)=>{const shortHome=data!.shortTeamNames?.[String(m.homeId)] ?? abbreviate(m.home); const shortAway=data!.shortTeamNames?.[String(m.awayId)] ?? abbreviate(m.away); const canPreview=!m.historical&&(m.finished||effectiveMode==="upcoming"); return <button key={m.id} disabled={!canPreview} className={"match-row grouped"+(isTeamHistory||!m.finished?" history-row":"")+(canPreview?"":" calendar-only")} onClick={canPreview?()=>m.finished?router.push(`/results/${m.id}`):setSelected(m):undefined}>
      {(view==="results"||isTeamHistory||!m.finished)&&<span className="history-fixture-meta">{(view!=="results"||isTeamHistory)&&<span>{displayDate(m.date)}</span>}<span>{kickoffTime(m.date)}</span>{showRowMatchday&&m.week>0&&<span className="fixture-matchday">MATCHDAY {m.week}</span>}</span>}
      <span className="match-teams"><span className="home-team"><span><span className="desktop-team-name">{data!.fullTeamNames?.[m.home] ?? shortHome}</span><span className="mobile-team-name">{shortHome}</span></span><Badge name={m.home} logos={data!.logos}/></span>
        <strong className="match-score">{m.finished?<>{m.homeGoals??"\u2014"} <span>&ndash;</span> {m.awayGoals??"\u2014"}</>:"vs"}</strong>
        <span className="away-team"><Badge name={m.away} logos={data!.logos}/><span><span className="desktop-team-name">{data!.fullTeamNames?.[m.away] ?? shortAway}</span><span className="mobile-team-name">{shortAway}</span></span></span></span>
      <span className="match-total">{view==="results"?<span className="fixture-status finished">{t("dash.fullTime").toUpperCase()}</span>:m.finished&&m.homeGoals!==null&&m.awayGoals!==null?<b className="goal-total">{m.homeGoals+m.awayGoals} {m.homeGoals+m.awayGoals===1?"goal":"goals"}</b>:<span className={"fixture-status "+m.status}>{canPreview?"Preview":fixtureLabel(m)}</span>}{canPreview&&<ChevronRight size={15}/>}</span>
      {view!=="upcoming"&&<span className="fixture-venue">{view!=="results"&&<span className="fixture-stadium"><StadiumIcon team={m.home} stadiums={data!.stadiums}/><span>{m.venue||"Venue unavailable"}</span></span>}{m.attendance!==null&&<span className="fixture-attendance" aria-label={"Attendance: "+m.attendance.toLocaleString("en-GB")}><Users size={11}/>{m.attendance.toLocaleString("en-GB")}</span>}</span>}
    </button>};
    return <section className={"panel results-panel"+(view==="results"?" results-list-page":"")}>
      <div className="panel-heading"><div>
        <h2>{selectedTeam?selectedTeam.name:week==="all"?t("dash.allMatchdays"):week?matchdayText(Number(week)):effectiveMode==="upcoming"?t("dash.upcomingFixtures"):t("dash.results")}</h2>
        <p className="match-range">{isTeamHistory?displaySeason(data!.season)+"   ·   "+visible.length+(effectiveMode==="upcoming"?" upcoming matches":" played matches"):matchdayDates(visible)}</p>
      </div>{isTeamHistory?<button className="text-button" onClick={()=>setTeamId(null)}><X size={13}/> {t("dash.clearTeamFilter")}</button>:view==="overview"?<button className="text-button" onClick={()=>selectView("results")}>{t("dash.viewResults")} <ArrowRight size={15}/></button>:null}</div>
      {isTeamHistory&&<p className="team-history-note">{seasonPartText(seasonPart)}   ·   {venueText(venue)}   ·   {periodText(period)}</p>}
      <div className="match-list">
        {!visible.length&&<div className="empty"><Search size={24}/><p>{!query&&!teamId&&effectiveMode==="upcoming"?"No upcoming fixtures in this selection.":!query&&!teamId?"No results in this selection.":"No matches match these filters."}</p><button className="text-button" onClick={()=>{setQuery("");setTeamId(null);setSeasonPart("all");setPeriod("ft");setVenue("all");setWeek(String(defaultMatchday(data?.matches??[],effectiveMode)??""));}}>{t("dash.clearFilters")}</button></div>}
      {view==="results" ? (()=>{const shownMatchdays=new Set<number>();return dateGroups.map(group=>{const groupMatchday=group.matches[0]?.week??0;const showHeader=showMatchdayHeaders&&groupMatchday>0&&!shownMatchdays.has(groupMatchday);if(showHeader)shownMatchdays.add(groupMatchday);return <div className="match-date-group" key={group.key}>
          {showHeader&&<div className="matchday-heading">{matchdayText(groupMatchday)}</div>}
          {group.matches.length>0&&<h3 className="match-date-heading">{fixtureDateHeading(group.matches[0].date,locale)}{isTeamHistory&&group.matches.every(match=>match.week===group.matches[0].week)&&group.matches[0].week>0&&<span className="fixture-matchday">{matchdayText(group.matches[0].week)}</span>}</h3>}
          {group.matches.map(match=>renderFixture(match,isTeamHistory&&group.matches.some(other=>other.week!==match.week)))}
         </div>})})() : visible.map(match=>renderFixture(match))}
      </div>
      <div className="panel-footer"><span className="status-dot"/><span>{effectiveMode==="upcoming"?"Upcoming fixtures":periodText(period)}</span></div>
    </section>;
  }

  function renderTable(full=false) {
    // The full standings table includes the same detailed columns as the
    // other full-table views, including the calculated last-five form.
    const detailed=full;
    const seasonConfig=data?.seasonConfigs?.find(config=>config.season===data.season);
    const configuredOutcomes=seasonConfig?.summary?.outcomes ?? seasonConfig?.outcomes ?? [];
    const hasVerifiedClassifications=configuredOutcomes.length>0;
    const showZones=full&&view==="standings"&&venue==="all"&&period==="ft"&&seasonPart==="all"&&standingsFrom===1&&standingsTo===seasonMatchdayCount&&(hasVerifiedClassifications||!seasonConfig);
    const unavailable=tableMatches.filter(m=>m.finished).length-completed(tableMatches).length;
    const zoneFor=(position:number, teamId:number)=>{
      if(!showZones)return null;
      const zone=configuredStandingsZone(configuredOutcomes,teamId,{champions:t("dash.champions"),championsLeague:t("dash.championsLeague"),europaLeague:t("dash.europaLeague"),conferenceLeague:t("dash.conferenceLeague"),relegationPlayoff:t("dash.relegationPlayoff"),relegated:t("dash.relegated")});
      if(zone && !(position===16 && zone.className==="relegated" && !configuredOutcomes.some(outcome=>outcome.type.toLowerCase().replace(/[^a-z]/g,"")==="relegationplayoff")))return zone;
      if(position===1)return {label:t("dash.champions"),className:"champions"};
      if(position<=4)return {label:t("dash.championsLeague"),className:"champions-league"};
      if(position===5)return {label:t("dash.europaLeague"),className:"europa-league"};
      if(position===6)return {label:t("dash.conferenceLeague"),className:"conference-league"};
      if(position===16)return {label:t("dash.relegationPlayoff"),className:"relegation-playoff"};
      if(position>=17)return {label:t("dash.relegated"),className:"relegated"};
      if(zone)return zone;
      return null;
    };
    return <section className={"panel league-panel"+(full?" expanded":"")}>
      <div className="panel-heading"><div><h2>{period==="ft"?t("dash.seasonStandings"):t("dash.standingsForPeriod",{period:periodText(period)})}</h2>
        <p className="match-range">{displaySeason(data!.season)}   ·   {seasonPartText(seasonPart)}   ·   {venueText(venue)}{view==="standings"?"   ·   MD "+standingsFrom+" to "+standingsTo:""}</p></div><Trophy size={19} className="muted"/></div>
      <div className="table-scroll"><table><thead><tr><th scope="col">#</th><th scope="col">{t("dash.club")}</th><th scope="col">{t("dash.matchesPlayed")}</th><th className="mobile-priority-column" scope="col">+/-</th><th className="mobile-priority-column" scope="col">{t("dash.points")}</th><th scope="col">{t("dash.wins")}</th><th scope="col">{t("dash.draws")}</th><th scope="col">{t("dash.losses")}</th>{detailed&&<><th scope="col">{t("dash.goalsFor")}</th><th scope="col">{t("dash.goalsAgainst")}</th></>}<th scope="col">+/-</th><th scope="col">{t("dash.points")}</th>{detailed&&<th scope="col">{t("standings.form")}</th>}</tr></thead>
        <tbody>{teams.map(t=>{const position=tableTeams.indexOf(t)+1;const zone=zoneFor(position,t.id);return <tr key={t.id} className={zone?`standing-zone-${zone.className}`:undefined}><td><span className={"rank "+(position<=4?"top ":"")+(zone?.className??"")} title={zone?.label}>{position}</span></td><td><button className="club-link" onClick={()=>{setTeamId(t.id);setQuery("");setWeek("all");setView("results");}}><Badge name={t.name} logos={data!.logos}/><span className="desktop-team-name">{data!.fullTeamNames?.[t.name] ?? t.name}</span><span className="mobile-team-name">{data!.shortTeamNames?.[String(t.id)] ?? abbreviate(t.name)}</span></button></td><td>{t.played}</td><td className="mobile-priority-column">{t.gf-t.ga>0?"+":""}{t.gf-t.ga}</td><td className="mobile-priority-column points" title={t.points_adjustment ? `Points adjustment: ${t.points_adjustment}` : undefined}>{t.points}{t.points_adjustment ? <small className="standings-deduction"> ({t.points_adjustment > 0 ? "+" : ""}{t.points_adjustment})</small> : null}</td><td>{t.won}</td><td>{t.drawn}</td><td>{t.lost}</td>{detailed&&<><td>{t.gf}</td><td>{t.ga}</td></>}<td>{t.gf-t.ga>0?"+":""}{t.gf-t.ga}</td><td className="points" title={t.points_adjustment ? `Points adjustment: ${t.points_adjustment}` : undefined}>{t.points}{t.points_adjustment ? <small className="standings-deduction"> ({t.points_adjustment > 0 ? "+" : ""}{t.points_adjustment})</small> : null}</td>{detailed&&<td><StandingsForm matches={tableMatches} teamId={t.id} venue={venue} locale={locale}/></td>}</tr>})}</tbody></table></div>
      {!teams.length&&<p className="empty">No clubs match your search.</p>}
      <div className="panel-footer">{!full&&<button className="text-button" onClick={()=>selectView("standings")}>{t("dash.fullStandings")} <ArrowRight size={13}/></button>}</div>
      {showZones&&<div className="standings-legend" aria-label={t("dash.qualificationPlaces")}><span className="legend-champions">{t("dash.champions")}</span><span className="legend-champions-league">{t("dash.championsLeague")}</span><span className="legend-europa-league">{t("dash.europaLeague")}</span><span className="legend-conference-league">{t("dash.conferenceLeague")}</span><span className="legend-relegation-playoff">{t("dash.relegationPlayoff")}</span><span className="legend-relegated">{t("dash.relegated")}</span></div>}
      {unavailable>0&&<p className="coverage-note">{unavailable} played matches have no imported {periodText(period).toLowerCase()} score. They are excluded from this table.</p>}
      <InsightsPlaceholder insightType="standings" description="Future analysis of league-position changes, recent form and season-long performance patterns." />
    </section>;
  }

  function renderOverview() {
    const trendOptions:{id:LeagueTrendMetric;label:string;percent?:boolean}[]=[
      {id:"goals",label:t("dash.metric.goals")},{id:"shots",label:t("dash.metric.shots")},{id:"shotsOnTarget",label:t("dash.metric.shotsOnTarget")},
      {id:"corners",label:t("dash.metric.corners")},{id:"yellowCards",label:t("dash.metric.yellowCards")},{id:"fouls",label:t("dash.metric.fouls")}
    ];
    const selectedTrend=trendOptions.find(option=>option.id===overviewMetric)!;
    const standingHeader=<div className="overview-table-header"><span>#</span><span>Club</span><span>MP</span><span>GD</span><span>Pts</span></div>;
    const configuredOverviewOutcomes=selectedSeasonConfig?.summary?.outcomes??selectedSeasonConfig?.outcomes??[];
    const summary=selectedSeasonConfig?.summary;
    const findConfiguredTeamId=(value:string|number)=>{
      if(typeof value === "number") return value;
      const key=normalizedTeamLabel(value);
      const exact=data!.teams.find(team=>normalizedTeamLabel(team.name)===key);
      if(exact)return exact.id;
      const matching=data!.teams.find(team=>{const teamKey=normalizedTeamLabel(team.name);return teamKey.endsWith(key)||key.endsWith(teamKey);});
      return matching?.id;
    };
    const compatibilityOutcomes=[...(summary?.european_qualifications??[]).flatMap(item=>{
      const teamIds=(item.teams??[]).map(findConfiguredTeamId).filter((id):id is number=>Number.isInteger(id));
      return teamIds.length?[{type:"qualification",competitionId:item.competition,label:item.competition,teamIds}]:[];
    }),...(summary?.relegated??[]).map(findConfiguredTeamId).filter((id):id is number=>Number.isInteger(id)).length?[{type:"relegated",competitionId:"bundesliga",label:"Relegated",teamIds:(summary?.relegated??[]).map(findConfiguredTeamId).filter((id):id is number=>Number.isInteger(id))}]:[]];
    const overviewOutcomes=[...configuredOverviewOutcomes,...compatibilityOutcomes];
    const overviewZoneFor=(teamId:number,position:number)=>data?.season==="2025-2026"&&position===6?{className:"conference-league",label:t("dash.conferenceLeague")}:data?.season==="2025-2026"&&position===7?null:data?.season==="2025-2026"&&position===16?{className:"relegation-playoff",label:t("dash.relegationPlayoff")}:configuredStandingsZone(overviewOutcomes,teamId,{champions:t("dash.champions"),championsLeague:t("dash.championsLeague"),europaLeague:t("dash.europaLeague"),conferenceLeague:t("dash.conferenceLeague"),relegationPlayoff:t("dash.relegationPlayoff"),relegated:t("dash.relegated")});
    const standingRow=(team:Team,index:number)=>{const position=index+1,zone=overviewZoneFor(team.id,position);return <button key={team.id} onClick={()=>setTeamId(team.id)}><span className={"rank "+(zone?.className??"")} title={zone?.label}>{position}</span><Badge name={team.name} logos={data!.logos}/><strong>{data!.shortTeamNames?.[String(team.id)] ?? abbreviate(team.name)}</strong><span>{team.played}</span><span>{team.gf-team.ga>0?"+":""}{team.gf-team.ga}</span><b>{team.points}</b></button>;};
    const displayedZoneClasses=new Set<StandingsZone["className"]>(overviewTable.map((team,index)=>overviewZoneFor(team.id,index+1)?.className).filter((value):value is StandingsZone["className"]=>Boolean(value)));
    return <div className="overview-dashboard">
      <div className="overview-summary-cards overview-summary-cards-main" aria-label="Latest matchday summary">
        <div className="overview-summary-card overview-kpi-card"><span className="overview-kpi-label">{t("dash.totalGoals")}</span><strong className="overview-kpi-value">{overviewResults.length?overviewSummary.goals:"-"}</strong><small className="overview-kpi-description">{latestCompletedWeek?`${matchdayText(latestCompletedWeek)} ${String.fromCharCode(8211)} ${t("dash.completedMatchesSuffix")}`:t("dash.noCompletedMatchday")}</small></div>
        <div className="overview-summary-card overview-kpi-card"><span className="overview-kpi-label">{t("dash.averageAttendance")}</span><strong className="overview-kpi-value">{overviewSummary.attendanceAverage===null?"-":Math.round(overviewSummary.attendanceAverage).toLocaleString("en-GB")}</strong><small className="overview-kpi-description">{overviewSummary.attendanceReported?t("dash.attendanceCoverage",{reported:overviewSummary.attendanceReported,total:overviewResults.length}):t("dash.attendanceUnavailable")}</small></div>
        <div className="overview-summary-card overview-kpi-card home-results-card"><span className="overview-kpi-label">{t("dash.homeResults")}</span><div className="overview-kpi-value home-results-line"><b><i>{overviewSummary.homeResults.won}</i>W</b><span>–</span><b><i>{overviewSummary.homeResults.drawn}</i>D</b><span>–</span><b><i>{overviewSummary.homeResults.lost}</i>L</b></div><small className="overview-kpi-description">{latestCompletedWeek?`${matchdayText(latestCompletedWeek)} ${String.fromCharCode(8211)} ${t("dash.completedMatchesSuffix")}`:t("dash.noCompletedMatchday")}</small></div>
      </div>      <div className="overview-top-grid">
        <section className="panel overview-results">
          <div className="panel-heading"><div><span className="eyebrow">{t("dash.latestResults")}</span><h2>{latestCompletedWeek?matchdayText(latestCompletedWeek):t("dash.noCompletedMatchday")}</h2><p className="match-range">{matchdayDates(overviewResults,locale)}{overviewScheduled>0?t("dash.fixtureStillToPlay",{count:overviewScheduled}):""}</p></div><button className="text-button" onClick={()=>selectView("results")}>{t("dash.viewAllResults")} <ArrowRight size={13}/></button></div>
          <div className="overview-results-list">{overviewResults.map(match=><button key={match.id} className="overview-result" onClick={()=>setSelected(match)}>
  <div className="overview-result-main">
    <span className="overview-club home"><span>{data!.shortTeamNames?.[String(match.homeId)] ?? abbreviate(match.home)}</span><Badge name={match.home} logos={data!.logos}/></span>
    <strong>{match.homeGoals} <span>&ndash;</span> {match.awayGoals}</strong>
    <span className="overview-club away"><Badge name={match.away} logos={data!.logos}/><span>{data!.shortTeamNames?.[String(match.awayId)] ?? abbreviate(match.away)}</span></span>
  </div>
  
</button>)}</div>
          {!overviewResults.length&&<p className="empty">{t("dash.noCompletedMatches")}</p>}
        </section>
        <section className="panel overview-standings">
          <div className="panel-heading"><div><span className="eyebrow">{t("dash.leagueStandings")}</span><h2>{t("dash.currentTable")}</h2><p className="match-range">{t("dash.completedFixtures")}</p></div><button className="text-button" onClick={()=>selectView("standings")}>{t("dash.fullStandings")} <ArrowRight size={13}/></button></div>
           <div className="overview-table"><div className="overview-table-rows"><div className="overview-table-half">{standingHeader}{overviewTable.slice(0,9).map((team,index)=>standingRow(team,index))}</div><div className="overview-table-half">{standingHeader}{overviewTable.slice(9).map((team,index)=>standingRow(team,index+9))}</div></div>{displayedZoneClasses.size>0&&<div className="overview-zone-legend"><>{displayedZoneClasses.has("champions")&&<span className="champions">{t("dash.champions")}</span>}{displayedZoneClasses.has("champions-league")&&<span className="champions-league">{t("dash.championsLeague")}</span>}{displayedZoneClasses.has("europa-league")&&<span className="europa-league">{t("dash.europaLeague")}</span>}{displayedZoneClasses.has("conference-league")&&<span className="conference-league">{t("dash.conferenceLeague")}</span>}{displayedZoneClasses.has("relegation-playoff")&&<span className="relegation-playoff">{t("dash.relegationPlayoff")}</span>}{displayedZoneClasses.has("relegated")&&<span className="relegated">{t("dash.relegated")}</span>}</></div>}</div>
        </section>
      </div>
      <section className="panel overview-trends">
        <div className="panel-heading"><div><span className="eyebrow">{t("dash.seasonTrends")}</span><h2>{selectedTrend.label}</h2><p className="match-range">{t("dash.leagueCompleted")}</p></div></div>
        <div className="trend-switch" aria-label="Season trend metric">{trendOptions.map(option=><button key={option.id} className={overviewMetric===option.id?"active":""} onClick={()=>setOverviewMetric(option.id)}>{option.label}</button>)}</div>
        <div className="trend-summary" aria-label={`${selectedTrend.label} summary`}><div><span>{t("dash.seasonAverage")}</span><strong>{overviewTrendSummary.average===null?"?":overviewTrendSummary.average.toFixed(selectedTrend.percent?1:2)+(selectedTrend.percent?"%":"")}</strong><small>{t("dash.eligibleCompleted")}</small></div><div><span>{t("dash.latestMatchdayLabel")}</span><strong>{overviewTrendSummary.latest===null?"?":overviewTrendSummary.latest.toFixed(selectedTrend.percent?1:2)+(selectedTrend.percent?"%":"")}</strong><small>{overviewTrend.length?matchdayText(overviewTrend.at(-1)!.week):"No completed matchday"}</small></div></div>
        <LeagueTrendChartAllExtremes points={overviewTrendWithExtremes} label={selectedTrend.label} percentValue={selectedTrend.percent}/>
      </section>
      <InsightsPlaceholder insightType="overview-trends" description="Future analysis of season trends, standout performances and significant changes across matchdays." />
    </div>;
  }

  if(isMatchReport)return null;
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Bundesliga analytics home"><img className="brand-logo" src="/brand/bundesliga-mark.svg" alt="Bundesliga logo" width={46} height={37}/><span>Bundesliga<b>FOOTBALL ANALYTICS</b></span></a>
      <span className="sidebar-label">{t("global.workspace")}</span>
      <nav aria-label={t("nav.overview")}>{navigation.map(item=><button key={item.id} onClick={()=>selectView(item.id)} className={view===item.id?"active":""} aria-current={view===item.id?"page":undefined}><item.icon size={19}/><span>{t(`nav.${item.id}`)}</span>{view===item.id&&<span className="nav-indicator"/>}</button>)}</nav>
      <div className="sidebar-bottom"><span className="database-icon"><Database size={17}/></span><div>{t("global.poweredBy")}<small>{t("global.sourceData")}</small></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><img className="header-league-mark" src="/brand/bundesliga-mark.svg" alt="" width={25} height={20}/><span>Bundesliga</span><ChevronRight size={13}/><strong>{view==="teamAnalysis"?t("teamAnalysis.title"):t(`nav.${view}`)}</strong></div>
        <div className="topbar-actions"><SettingsMenu/></div>
      </header>
      <main id="main">
        <div className="page-heading"><div><span className="eyebrow"><span className="germany-flag"/> {t("global.germany")} · {t("global.bundesliga")}</span><h1>{view==="teamAnalysis"?t("teamAnalysis.title"):t(`page.${view}`)}</h1><p>{view==="overview"?shortSeason(data?.season||""):(view==="teams"||view==="players")?t("global.developing"):view==="history"?t("page.historyDescription"):view==="teamAnalysis"?t("teamAnalysis.subtitle"):view==="results"?t("page.resultsDescription"):t("page.description")}</p></div>

        </div>
        {view==="overview"&&<div className="overview-page-context">{shortSeason(data?.season||"")}{latestCompletedWeek?` ${String.fromCharCode(8211)} ${matchdayText(latestCompletedWeek)}`:""}{overviewResults[0]?.date?` ${String.fromCharCode(8211)} ${displayDate(overviewResults[overviewResults.length-1]?.date??overviewResults[0].date,locale)}`:""}</div>}

        {view!=="overview"&&view!=="teams"&&view!=="players"&&view!=="teamAnalysis"&&view!=="history"&&<div className={"filter-bar"+(view==="results"?" results-toolbar":"")+(view==="standings"?(standingsFiltersOpen?" standings-filter-bar filters-open":" standings-filter-bar"):"")} role="group" aria-label={view==="upcoming"?"Upcoming matchday filter":"Season and matchday filters"}>
          {view==="standings"&&<button type="button" className="standings-filter-toggle" aria-expanded={standingsFiltersOpen} onClick={()=>setStandingsFiltersOpen(value=>!value)}><span>Filters &middot; {shortSeason(season||data?.season||"")} &middot; MD {standingsFrom}&#8211;{standingsTo}</span><ChevronDown size={16}/></button>}
          <div className="standings-filter-fields">
          {view!=="upcoming"&&<div className="filter-field">
            <label htmlFor="season-filter">{t("dash.season")}</label>
            <div className="season-selector"><CalendarDays size={16}/>
              <select id="season-filter" aria-label={t("dash.season")} value={season||data?.season||""}
                onChange={e=>{setWeek("");setTeamId(null);setSeason(e.target.value);}} disabled={!data||loading}>
                {!data&&<option>Loading...</option>}
                {data?.seasons.map(s=><option key={s} value={s}>{displaySeason(s)}</option>)}
              </select><ChevronDown size={14}/>
            </div>
          </div>}
          {view!=="standings"&&<div className="filter-field matchday-field">
            <label htmlFor="matchday-filter">{t("dash.matchday")}</label>
            <div className="matchday-controls">
              <button className="matchday-step" aria-label="Previous matchday" disabled={loading||!week||weekIndex<=0}
                onClick={()=>setWeek(String(weeks[weekIndex-1]))}><ChevronLeft size={17}/></button>
              <div className="season-selector"><select id="matchday-filter" aria-label={t("dash.matchday")} value={week}
                onChange={e=>setWeek(e.target.value)} disabled={!data||loading}>
                {!data&&<option value="">Loading matchdays...</option>}{view==="results"&&<option value="all">{t("dash.allMatchdays")}</option>}
                {weeks.map(w=><option value={w} key={w}>{matchdayText(w)}</option>)}
              </select><ChevronDown size={14}/></div>
              <button className="matchday-step" aria-label="Next matchday" disabled={loading||!week||weekIndex<0||weekIndex>=weeks.length-1}
                onClick={()=>setWeek(String(weeks[weekIndex+1]))}><ChevronRight size={17}/></button>
              {view==="results"&&<button className="latest-matchday" onClick={()=>setWeek(String(preferredWeek??weeks.at(-1)??""))} disabled={loading||!weeks.length}>{t("dash.latest")}</button>}
            </div>
          </div>}

          {view==="standings"&&<>
            <div className="filter-field"><label htmlFor="standings-from">{t("filters.fromMatchday")}</label><div className="season-selector">
              <select id="standings-from" aria-label={t("filters.fromMatchday")} value={standingsFrom} onChange={e=>{const next=Number(e.target.value);setStandingsFrom(next);setStandingsTo(previous=>Math.max(previous,next));}}>
                {Array.from({length:seasonMatchdayCount},(_,i)=>i+1).map(w=><option value={w} key={w}>{matchdayText(w)}</option>)}
              </select><ChevronDown size={14}/></div></div>
            <div className="filter-field"><label htmlFor="standings-to">{t("filters.toMatchday")}</label><div className="season-selector">
              <select id="standings-to" aria-label={t("filters.toMatchday")} value={standingsTo} onChange={e=>{const next=Number(e.target.value);setStandingsTo(next);setStandingsFrom(previous=>Math.min(previous,next));}}>
                {Array.from({length:seasonMatchdayCount},(_,i)=>i+1).map(w=><option value={w} key={w}>{matchdayText(w)}</option>)}
              </select><ChevronDown size={14}/></div></div>
          </>}
          {view!=="upcoming"&&view!=="results"&&<div className="filter-field venue-field">
            <label htmlFor="venue-filter">{t("filters.venue")}</label>
            <div className="season-selector"><select id="venue-filter" aria-label={t("filters.venue")} value={venue} onChange={e=>setVenue(e.target.value as VenueFilter)}>
              <option value="all">{t("filters.allVenues")}</option><option value="home">{t("filters.home")}</option><option value="away">{t("filters.away")}</option>
            </select><ChevronDown size={14}/></div>
          </div>}
          {view!=="upcoming"&&view!=="results"&&<div className="filter-field">
            <label htmlFor="season-part-filter">{t("filters.seasonPhase")}</label>
            <div className="season-selector"><select id="season-part-filter" aria-label={t("filters.seasonPhase")} value={seasonPart} onChange={e=>setSeasonPart(e.target.value as SeasonPart)}>
              <option value="all">{t("filters.fullSeason")}</option><option value="first">{t("filters.firstHalf")}</option><option value="second">{t("filters.secondHalf")}</option>
            </select><ChevronDown size={14}/></div>
          </div>}
          {view!=="upcoming"&&view!=="results"&&!historicalSeason&&<div className="filter-field">
            <label htmlFor="period-filter">{t("filters.matchPeriod")}</label>
            <div className="season-selector"><select id="period-filter" aria-label={t("filters.matchPeriod")} value={period} onChange={e=>{setSelected(null);setPeriod(e.target.value as MatchPeriod);}}>
              {PERIODS.map(p=><option value={p.value} key={p.value}>{periodText(p.value)}</option>)}
            </select><ChevronDown size={14}/></div>
          </div>}
          {view!=="upcoming"&&view!=="results"&&data&&!loading&&!error&&<div className="filter-context" role="status">
            <span className="status-dot"/><span>{view==="standings"?matchdayRangeText(standingsFrom,standingsTo):isTeamHistory?seasonPartText(seasonPart):matchdayText(Number(week))}</span>
            {view!=="standings"&&!isTeamHistory&&week!==String(preferredWeek??"")&&<button className="text-button" onClick={()=>setWeek(String(preferredWeek??""))}>{effectiveMode==="upcoming"?"Next fixture":"Latest"} <ChevronRight size={12}/></button>}
            {view==="standings"&&<button className="text-button" onClick={()=>{setStandingsFrom(1);setStandingsTo(seasonMatchdayCount);setSeasonPart("all");setPeriod("ft");setVenue("all");setQuery("");}}>{t("dash.resetStandings")}</button>}
          </div>}
          </div>
        </div>}
        <div aria-live="polite">
          {loading ? <div className="loading-state"><LoaderCircle className="spin" size={29}/><h2>Reading the game...</h2><p>Loading imported Bundesliga results and statistics.</p><div className="skeleton-grid">{[1,2,3,4].map(i=><div className="skeleton" key={i}/>)}</div></div>:
          error ? <section className="error-state"><Database size={30}/><h2>Let's connect your data.</h2><p>{error}</p><button className="primary-button" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/> Try again</button></section>:
          data && (((view as string)==="teams"||(view as string)==="players") ? (view==="teams" ? <section className="team-directory"><div className="team-directory-grid">{data.teams.map(team=><button type="button" className="panel team-directory-card" key={team.id} onClick={()=>router.push(`/teams/${team.id}`)}><Badge name={team.name} logos={data.logos} large/><strong>{data.fullTeamNames?.[team.name] ?? team.name}</strong><span>{t("teamAnalysis.openAnalysis")}</span><ChevronRight size={15}/></button>)}</div></section> : <DevelopmentPage title={allNavigation.find(item=>item.id===view)?.label??"Page"}/>) : <>
            {missingPeriod>0&&<p className="coverage-note" role="status">{missingPeriod} played matches in this selection have no imported {periodText(period).toLowerCase()} score. Goal summaries exclude them.</p>}
            {view!=="overview"&&view!=="standings"&&view!=="results"&&view!=="teamAnalysis"&&view!=="history"&&effectiveMode!=="upcoming"&&<div className="metric-grid">
              {[
                {label:"Total goals",value:missingPeriod>0&&!summary.played?"?":summary.goals.toLocaleString("en-GB"),note:summary.played+" matches   ·   "+periodText(period),icon:Goal},
                {label:"Goals per game",value:missingPeriod>0&&!summary.played?"?":summary.average.toFixed(2),note:isTeamHistory||venue==="all"?"Combined home and away goals":venue==="home"?"Home-team goals":"Away-team goals",icon:Activity},
                {label:"Average attendance",value:attendance.average===null?"?":Math.round(attendance.average).toLocaleString("en-GB"),note:attendance.count+" of "+attendance.matches+" matches reported",icon:Users},
                {label:isTeamHistory?"Team W"+String.fromCharCode(8211)+"D"+String.fromCharCode(8211)+"L":venue==="away"?"Away W"+String.fromCharCode(8211)+"D"+String.fromCharCode(8211)+"L":"Home W"+String.fromCharCode(8211)+"D"+String.fromCharCode(8211)+"L",value:missingPeriod>0&&!summary.played?"?":homeRecord.wins+" "+String.fromCharCode(8211)+" "+homeRecord.draws+" "+String.fromCharCode(8211)+" "+homeRecord.losses,note:isTeamHistory?"Wins   ·   Draws   ·   Losses":venue==="away"?"Away wins   ·   Draws   ·   Away losses":"Home wins   ·   Draws   ·   Home losses",icon:Trophy}
              ].map((metric,i)=><section className={"metric-card"+(i===3?" accent":"")} key={metric.label}><div><span>{metric.label}</span><metric.icon size={18}/></div><strong>{metric.value}</strong><small>{i===3&&<span className="status-dot"/>}{metric.note}</small></section>)}
            </div>}
            {(view as string)==="goals"&&<div className="toolbar"><div className="view-tabs" aria-label="Dashboard sections">{navigation.map(item=><button key={item.id} className={view===item.id?"selected":""} onClick={()=>selectView(item.id)}>{item.label}</button>)}</div>
              <label className="search-box"><Search size={15}/><input placeholder="Search a club..." aria-label="Search clubs" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-button" aria-label="Clear search" onClick={()=>setQuery("")}><X size={13}/></button>}</label>
            </div>}
            {view==="overview" && renderOverview()}
            {view==="history" && <BundesligaHistory data={data} />}
            {(view==="results"||view==="upcoming") && renderResults()}
            {view==="standings" && renderTable(true)}
            {view==="teamAnalysis" && teamAnalysisId !== null && <TeamAnalysis data={data} teamId={teamAnalysisId} season={data.season} onSeasonChange={next=>{setSeason(next);setTeamId(teamAnalysisId);}} onBack={()=>router.push("/teams")} />}

            {(view==="players"||view==="predictions")&&<section className="panel coming-soon"><span className="eyebrow">ROADMAP</span><h2>{view==="players"?"Player analytics":"Predictions"}</h2><p>This page is prepared in navigation and will be developed in its scheduled phase.</p></section>}
            {view==="goals" && <div className="dashboard-grid">
              <div className="wide-column">
                <section className="panel">
                  <div className="panel-heading"><div><span className="eyebrow">SCORING PATTERNS</span><h2>Goals per match</h2></div></div>
                  <div className="goal-histogram" role="img" aria-label={"Goal distribution across "+summary.played+" completed matches"}>
                    {distribution.map(bucket=><div className="goal-bucket" key={bucket.label}>
                      <span className="bucket-count">{bucket.count}</span>
                      <div className="bucket-track"><span style={{height:bucket.count/Math.max(1,...distribution.map(b=>b.count))*100+"%"}}/></div>
                      <strong>{bucket.label}</strong><small>goals</small>
                    </div>)}
                  </div>
                  <p className="histogram-note">Recorded results{week!=="all"?"   ·   Matchday "+week:""}</p>
                </section>
                
              </div>
              <div className="narrow-column">
                <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ATTACKING OUTPUT</span><h2>Leading scorers</h2></div></div>
                  <div className="scorers">{ranked.map(t=><button key={t.id} onClick={()=>{setTeamId(t.id);setView("results");}}><Badge name={t.name} logos={data.logos}/><span>{abbreviate(t.name)}<small>{t.played} matches played</small></span><b>{(t.gf/t.played).toFixed(2)}<small>goals / match</small></b></button>)}</div>
                </section>
              </div>
            </div>}


            {view==="goals"&&<section className="panel trend-panel trend-wide">
              <div className="panel-heading"><div><span className="eyebrow">SCORING PATTERNS</span><h2>Average goals by matchday</h2><p className="match-range">{seasonPartText(seasonPart)}   ·   {periodText(period)}   ·   {venueText(venue)}</p></div><span className="legend"><i/> Goals / match</span></div>
              <TrendChart matches={historyMatches} venue={venue}/>
            </section>}

            <footer className="page-footer">{isTeamHistory&&<span><span className="status-dot"/> {selectedTeam?.name}   ·   Full season</span>}<span>Updated {new Date(data.fetchedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}   ·   Refresh as results progress</span></footer>
          </>)}
        </div>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation" style={{gridTemplateColumns:"repeat("+navigation.length+",minmax(0,1fr))"}}>{navigation.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>selectView(item.id)} aria-current={view===item.id?"page":undefined}><item.icon size={20}/><span>{item.label}</span></button>)}</nav>
    {selected&&data&&<MatchDialog match={selected} data={data} period={period} onClose={()=>setSelected(null)}/>}
  </div>;
}









