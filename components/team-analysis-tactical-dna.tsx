"use client";
import { Shield, Target, TrendingUp } from "lucide-react";
import type { Dashboard, MatchStats, PeriodStats } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);
export default function TeamAnalysisTacticalDNA({data,teamId}:{data:Dashboard;teamId:number}){
  const {t}=useI18n();
  const matches=data.matches.filter(match=>match.finished&&match.homeGoals!==null&&match.awayGoals!==null&&(match.homeId===teamId||match.awayId===teamId));
  const stats=new Map(data.stats.map(row=>[`${row.gameId}:${row.teamId}`,row]));
  const values=(key:keyof PeriodStats)=>matches.map(match=>{const row=stats.get(`${match.id}:${teamId}`)?.periods?.ft;const value=row?.[key];return finite(value)?value:null}).filter((value):value is number=>value!==null);
  const average=(key:keyof PeriodStats)=>{const list=values(key);return list.length?list.reduce((sum,value)=>sum+value,0)/list.length:null};
  const possession=average("possession");
  const metrics=[
    {label:t("teamAnalysis.possession"),value:possession===null?"—":`${(possession<=1?possession*100:possession).toFixed(1)}%`,icon:Shield},
    {label:t("stats.metric.pass_attempt"),value:average("passes")===null?"—":average("passes")!.toFixed(1),icon:TrendingUp},
    {label:t("stats.metric.shots"),value:average("shots")===null?"—":average("shots")!.toFixed(1),icon:Target},
    {label:t("stats.metric.ball_recoveries"),value:average("recoveries")===null?"—":average("recoveries")!.toFixed(1),icon:Shield}
  ];
  return <section className="team-analysis-tactical-dna"><div className="panel-heading"><div><span className="eyebrow">{t("teamAnalysis.tactical")}</span><h2>{t("teamAnalysis.tacticalIdentity")}</h2><p>{t("teamAnalysis.tacticalIdentityDescription")}</p></div></div><div className="team-analysis-tactical-grid">{metrics.map(metric=>{const Icon=metric.icon;return <article className="panel team-analysis-tactical-metric" key={metric.label}><Icon size={17}/><span>{metric.label}</span><strong>{metric.value}</strong><small>{t("teamAnalysis.sampleSize",{count:matches.length})}</small></article>})}</div></section>;
}

