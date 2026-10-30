"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowLeftRight, BarChart3, CalendarDays, ChevronRight, Flag, Hand, Shield, Swords, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { standings } from "@/lib/analytics";
import type { Dashboard, Match, MatchPeriod, MatchStats, VenueFilter } from "@/lib/types";
import TeamAnalysisScatter from "./team-analysis-scatter";
import TeamAnalysisStatisticalPerformance from "./team-analysis-statistical-performance";
import TeamAnalysisSeasonTrend from "./team-analysis-season-trend";
import TeamAnalysisTacticalDNA from "./team-analysis-tactical-dna";
import { ForecastFoundation, SeasonEvolution, StrengthsWeaknesses, TacticalDNAWorkspace, TeamComparisons } from "./team-analysis-advanced";
import type { TeamAnalysisCategory } from "./team-analysis-metrics";

type Tab = "overview" | "performance" | "tactical" | "strengths" | "comparisons" | "seasonEvolution" | "forecast";
type Props = { data: Dashboard; teamId: number; season: string; onSeasonChange: (season: string) => void; onBack: () => void };
const localeMap = { en: "en-GB", de: "de-DE", es: "es-ES", ro: "ro-RO" } as const;
const formatDate = (value: string, locale: keyof typeof localeMap) => new Intl.DateTimeFormat(localeMap[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(value));
const valueOrDash = (value: number | null | undefined, digits = 0) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";

function Crest({ name, data }: { name: string; data: Dashboard }) {
  const src = data.logos[name];
  return <span className="team-analysis-crest">{src ? <img src={src} alt="" /> : <span>{name.split(/\s+/).map(part => part[0]).join("").slice(0, 3)}</span>}</span>;
}

function EmptyState({ text }: { text: string }) { return <div className="team-analysis-empty"><BarChart3 size={23} /><p>{text}</p></div>; }

export default function TeamAnalysis({ data, teamId, season, onSeasonChange, onBack }: Props) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [performanceFrom, setPerformanceFrom] = useState(1);
  const [performanceTo, setPerformanceTo] = useState(34);
  const [performanceVenue, setPerformanceVenue] = useState<VenueFilter>("all");
  const [performancePeriod, setPerformancePeriod] = useState<MatchPeriod>("ft");
  const [performanceCategory, setPerformanceCategory] = useState<TeamAnalysisCategory>("attacking");
  const team = data.teams.find(entry => entry.id === teamId);
  const teamMatches = useMemo(() => data.matches.filter(match => match.finished && match.homeGoals !== null && match.awayGoals !== null && (match.homeId === teamId || match.awayId === teamId)).sort((a, b) => b.date.localeCompare(a.date)), [data.matches, teamId]);
  const seasonConfig = data.seasonConfigs?.find(config => config.season === data.season);
  const table = useMemo(() => standings(data.matches.filter(match => match.finished), "all", data.matches, seasonConfig?.rules?.pointsForWin ?? 3, seasonConfig?.standingsTiebreakers, seasonConfig?.rules?.pointsForDraw ?? 1, seasonConfig), [data, seasonConfig]);
  const standing = table.find(entry => entry.id === teamId);
  const name = team?.name ?? (teamMatches[0]?.homeId === teamId ? teamMatches[0]?.home : teamMatches[0]?.away) ?? t("teamAnalysis.team");
  const fullName = data.fullTeamNames?.[name] ?? name;
  const ft = (row: MatchStats | undefined) => row?.periods?.ft;
  const statByGameTeam = useMemo(() => new Map(data.stats.map(row => [`${row.gameId}:${row.teamId}`, row])), [data.stats]);
  const aggregate = useMemo(() => {
    const average = (values: Array<number | null | undefined>, possession = false) => {
      const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      if (!usable.length) return null;
      const result = usable.reduce((total, value) => total + value, 0) / usable.length;
      return possession && result <= 1 ? result * 100 : result;
    };
    const metric = (key: "shots" | "onTarget" | "corners" | "yellowCards", against: boolean) => average(teamMatches.map(match => {
      const opponentId = match.homeId === teamId ? match.awayId : match.homeId;
      const row = statByGameTeam.get(`${match.id}:${against ? opponentId : teamId}`);
      return ft(row);
    }).map(row => row?.[key]));
    const goalsFor = average(teamMatches.map(match => match.homeId === teamId ? match.homeGoals : match.awayGoals));
    const goalsAgainst = average(teamMatches.map(match => match.homeId === teamId ? match.awayGoals : match.homeGoals));
    const possession = (against: boolean) => average(teamMatches.map(match => {
      const opponentId = match.homeId === teamId ? match.awayId : match.homeId;
      return ft(statByGameTeam.get(`${match.id}:${against ? opponentId : teamId}`))?.possession;
    }), true);
    return {
      goalsFor, goalsAgainst, possessionFor: possession(false), possessionAgainst: possession(true),
      shotsFor: metric("shots", false), shotsAgainst: metric("shots", true),
      onTargetFor: metric("onTarget", false), onTargetAgainst: metric("onTarget", true),
      cornersFor: metric("corners", false), cornersAgainst: metric("corners", true),
      cardsFor: metric("yellowCards", false), cardsAgainst: metric("yellowCards", true), matches: teamMatches.length
    };
  }, [statByGameTeam, teamId, teamMatches]);
  const trend = useMemo(() => {
    const groups = new Map<number, { scored: number; conceded: number; matches: Match[] }>();
    for (const match of teamMatches) { const current = groups.get(match.week) ?? { scored: 0, conceded: 0, matches: [] }; const home = match.homeId === teamId; current.scored += home ? match.homeGoals! : match.awayGoals!; current.conceded += home ? match.awayGoals! : match.homeGoals!; current.matches.push(match); groups.set(match.week, current); }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]).slice(-10);
  }, [teamMatches, teamId]);
  const performanceMaxWeek = Math.max(1, ...data.matches.map(match => match.week || 0));
  const performanceFilters = { from: performanceFrom, to: Math.min(performanceTo, performanceMaxWeek), venue: performanceVenue, period: performancePeriod };
  const tabs: Array<[Tab, string]> = [["overview", t("teamAnalysis.overview")], ["performance", t("teamAnalysis.performance")], ["tactical", t("teamAnalysis.tactical")], ["strengths", t("teamAnalysis.strengths")], ["comparisons", t("teamAnalysis.comparisons")], ["seasonEvolution", t("teamAnalysis.seasonEvolution")], ["forecast", t("teamAnalysis.forecast")]];
  const recent = teamMatches.slice(0, 5);
  const summaryRows: Array<[string, string, number | null, number]> = [
    [t("teamAnalysis.goalsPerMatch"), valueOrDash(aggregate.goalsFor, 2), aggregate.goalsFor, 5],
    [t("teamAnalysis.possession"), aggregate.possessionFor === null ? "—" : `${aggregate.possessionFor.toFixed(1)}%`, aggregate.possessionFor, 100],
    [t("teamAnalysis.shotsPerMatch"), valueOrDash(aggregate.shotsFor, 1), aggregate.shotsFor, 15],
    [t("teamAnalysis.shotsOnTarget"), valueOrDash(aggregate.onTargetFor, 1), aggregate.onTargetFor, 8],
    [t("teamAnalysis.cornersPerMatch"), valueOrDash(aggregate.cornersFor, 1), aggregate.cornersFor, 10],
    [t("teamAnalysis.yellowCardsPerMatch"), valueOrDash(aggregate.cardsFor, 1), aggregate.cardsFor, 5]
  ];
  type PerformanceMetric = "goals" | "possession" | "shots" | "onTarget" | "corners" | "yellowCards";
  const completedForTeam = (id: number) => data.matches.filter(match => match.finished && match.homeGoals !== null && match.awayGoals !== null && (match.homeId === id || match.awayId === id));
  const teamMetric = (id: number, metric: PerformanceMetric, against: boolean) => {
    const matches = completedForTeam(id);
    const values = matches.map(match => {
      const home = match.homeId === id;
      if (metric === "goals") return home === against ? match.awayGoals : match.homeGoals;
      const rowTeam = against ? (home ? match.awayId : match.homeId) : id;
      const row = ft(statByGameTeam.get(`${match.id}:${rowTeam}`));
      if (metric === "possession") return row?.possession;
      return row?.[metric];
    }).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!values.length) return null;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return metric === "possession" && average <= 1 ? average * 100 : average;
  };
  const rankedMetrics = (metric: PerformanceMetric, against: boolean) => {
    const values = table.map(entry => ({ id: entry.id, value: teamMetric(entry.id, metric, against) })).filter((entry): entry is { id: number; value: number } => entry.value !== null);
    const higherIsBetter = metric === "yellowCards" ? against : !against;
    return { values, higherIsBetter };
  };
  const performanceCards = (against: boolean) => ([
    { metric: "goals" as const, label: t("teamAnalysis.summaryGoals"), value: against ? aggregate.goalsAgainst : aggregate.goalsFor },
    { metric: "possession" as const, label: t("teamAnalysis.summaryPossession"), value: against ? aggregate.possessionAgainst : aggregate.possessionFor },
    { metric: "shots" as const, label: t("teamAnalysis.summaryShots"), value: against ? aggregate.shotsAgainst : aggregate.shotsFor },
    { metric: "onTarget" as const, label: t("teamAnalysis.summaryShotsOnTarget"), value: against ? aggregate.onTargetAgainst : aggregate.onTargetFor },
    { metric: "corners" as const, label: t("teamAnalysis.summaryCorners"), value: against ? aggregate.cornersAgainst : aggregate.cornersFor },
    { metric: "yellowCards" as const, label: t("teamAnalysis.summaryYellowCards"), value: against ? aggregate.cardsAgainst : aggregate.cardsFor }
  ]).map(item => {
    const ranked = rankedMetrics(item.metric, against);
    const ordered = [...ranked.values].sort((a, b) => ranked.higherIsBetter ? b.value - a.value : a.value - b.value);
    const selected = ordered.find(entry => entry.id === teamId);
    const rank = selected ? 1 + ordered.filter(entry => ranked.higherIsBetter ? entry.value > selected.value : entry.value < selected.value).length : null;
    const count = ordered.length;
    return { ...item, rank, count, percentage: rank === null || !count ? null : (against ? (rank / count) * 100 : ((count - rank + 1) / count) * 100) };
  });
  const resultFor = (match: Match) => { const home = match.homeId === teamId; const scored = home ? match.homeGoals! : match.awayGoals!; const conceded = home ? match.awayGoals! : match.homeGoals!; return { scored, conceded, result: scored > conceded ? "W" : scored === conceded ? "D" : "L", opponent: home ? match.away : match.home }; };
  return <section className="team-analysis-workspace">
    <button className="team-analysis-back" type="button" onClick={onBack}><ArrowLeft size={15} /> {t("teamAnalysis.backToTeams")}</button>
    <div className="team-analysis-header"><div className="team-analysis-identity"><Crest name={name} data={data} /><div><span className="eyebrow">{t("global.germany")} · {t("global.bundesliga")}</span><h1>{fullName}</h1><p>{t("teamAnalysis.selectedSeason")} · {season.replace("-", " / ")}</p></div></div><div className="team-analysis-filters"><label className="team-analysis-season"><span>{t("teamAnalysis.season")}</span><span className="season-selector"><CalendarDays size={15}/><select value={season} onChange={event => onSeasonChange(event.target.value)}>{data.seasons.map(option => <option key={option} value={option}>{option.replace("-", " / ")}</option>)}</select></span></label></div></div>
    <nav className="team-analysis-tabs" role="tablist" aria-label={t("teamAnalysis.tabsLabel")}>{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === "overview" && <div className="team-analysis-overview">
      <div className="team-analysis-kpis">{[[t("teamAnalysis.leaguePosition"), standing ? String(table.indexOf(standing) + 1) : "—"], [t("teamAnalysis.points"), standing ? String(standing.points) : "—"], [t("teamAnalysis.matchesPlayed"), standing ? String(standing.played) : "—"], [t("teamAnalysis.record"), standing ? `${standing.won}–${standing.drawn}–${standing.lost}` : "—"], [t("teamAnalysis.goalsScored"), standing ? String(standing.gf) : "—"], [t("teamAnalysis.goalsConceded"), standing ? String(standing.ga) : "—"], [t("teamAnalysis.goalDifference"), standing ? `${standing.gf - standing.ga > 0 ? "+" : ""}${standing.gf - standing.ga}` : "—"]].map(([label, value]) => <div className="team-analysis-kpi" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="team-analysis-performance-cards"><section className="panel team-analysis-performance-card for-card"><div className="panel-heading"><div><h2>{t("teamAnalysis.for")} <TrendingUp size={21} aria-hidden="true" /></h2><p>{t("teamAnalysis.seasonAveragesNote")}</p></div></div><div className="team-analysis-metric-list">{performanceCards(false).map(item => <div key={item.metric}><span>{item.label}</span><strong>{item.value === null ? "—" : item.metric === "possession" ? `${item.value.toFixed(1)}%` : item.value.toFixed(2)} </strong><i><b style={{ width: `${item.percentage ?? 0}%` }} /></i></div>)}</div></section><section className="panel team-analysis-performance-card against-card"><div className="panel-heading"><div><h2>{t("teamAnalysis.against")} <TrendingDown size={21} aria-hidden="true" /></h2><p>{t("teamAnalysis.seasonAveragesNote")}</p></div></div><div className="team-analysis-metric-list">{performanceCards(true).map(item => <div key={item.metric}><span>{item.label}</span><strong>{item.value === null ? "—" : item.metric === "possession" ? `${item.value.toFixed(1)}%` : item.value.toFixed(2)} </strong><i><b style={{ width: `${item.percentage ?? 0}%` }} /></i></div>)}</div></section></div>
      <section className="panel team-analysis-intelligence team-analysis-intelligence-compact"><div className="panel-heading"><div><span className="eyebrow">{t("teamAnalysis.intelligence")}</span><h2>{t("teamAnalysis.teamIntelligence")}</h2></div></div><p>{t("teamAnalysis.intelligenceUnavailable")}</p></section>
    </div>}
    {tab === "performance" && <section className="team-analysis-tab-content"><div className="team-analysis-shared-filters"><label><span>{t("filters.fromMatchday")}</span><select value={performanceFrom} onChange={event=>setPerformanceFrom(Number(event.target.value))}>{Array.from({length:performanceMaxWeek},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label><label><span>{t("filters.toMatchday")}</span><select value={performanceFilters.to} onChange={event=>setPerformanceTo(Number(event.target.value))}>{Array.from({length:performanceMaxWeek},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label><label><span>{t("filters.venue")}</span><select value={performanceVenue} onChange={event=>setPerformanceVenue(event.target.value as VenueFilter)}><option value="all">{t("filters.allVenues")}</option><option value="home">{t("filters.home")}</option><option value="away">{t("filters.away")}</option></select></label><label><span>{t("filters.matchPeriod")}</span><select value={performancePeriod} onChange={event=>setPerformancePeriod(event.target.value as MatchPeriod)}><optgroup label={t("teamAnalysis.matchPeriodGroup")}><option value="ft">{t("ui.fullMatch")}</option><option value="fh">{t("ui.firstHalf")}</option><option value="sh">{t("ui.secondHalf")}</option></optgroup><optgroup label={t("teamAnalysis.minutePeriodsGroup")}>{(["m_1_15","m_16_30","m_31_45","m_46_60","m_61_75","m_76_90","m_1_30","m_31_60","m_61_90"] as MatchPeriod[]).map(period=><option key={period} value={period}>{t(`period.${period}`)}</option>)}</optgroup></select></label></div><div className="team-analysis-analysis-workspace"><div className="team-analysis-category-tabs" role="tablist">{([["attacking",Target],["defending",Shield],["passing",ArrowLeftRight],["possession",Swords],["discipline",Flag],["goalkeeping",Hand]] as const).map(([id,Icon])=><button key={id} role="tab" aria-selected={performanceCategory===id} className={performanceCategory===id?"active":""} onClick={()=>setPerformanceCategory(id)}><Icon size={15}/>{t(`teamAnalysis.${id==="possession"?"possessionCategory":id}`)}</button>)}</div><TeamAnalysisStatisticalPerformance data={data} teamId={teamId} filters={performanceFilters} category={performanceCategory} /><TeamAnalysisSeasonTrend data={data} teamId={teamId} filters={performanceFilters} category={performanceCategory} /><TeamAnalysisScatter data={data} teamId={teamId} filters={performanceFilters} category={performanceCategory} /></div></section>}
    {tab === "tactical" && <section className="team-analysis-tab-content"><TacticalDNAWorkspace data={data} teamId={teamId} season={season}/></section>}
    {tab === "strengths" && <section className="team-analysis-tab-content"><StrengthsWeaknesses data={data} teamId={teamId} season={season}/></section>}
    {tab === "comparisons" && <section className="team-analysis-tab-content"><TeamComparisons data={data} teamId={teamId} season={season}/></section>}
    {tab === "seasonEvolution" && <section className="team-analysis-tab-content"><SeasonEvolution data={data} teamId={teamId} season={season}/></section>}
    {tab === "forecast" && <section className="team-analysis-tab-content"><ForecastFoundation /></section>}
  </section>;
}





