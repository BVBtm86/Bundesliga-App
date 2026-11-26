"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, BarChart3, Brain, ChevronRight, CircleAlert, Crosshair, Gauge, Shield, Swords, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Dashboard, Match, MatchStats, PeriodStats } from "@/lib/types";
import TacticalDNAPassing from "./tactical-dna-passing";
import { toPercent } from "./team-analysis-value";

type Props = { data: Dashboard; teamId: number; season: string };
type TacticalSection = "identity" | "strengths" | "atlas" | "passing" | "sequences" | "attacking" | "styles";
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const completed = (data: Dashboard, id: number) => data.matches.filter(m => m.finished && m.homeGoals !== null && m.awayGoals !== null && (m.homeId === id || m.awayId === id));
const rowFor = (stats: Map<string, MatchStats>, matchId: number, teamId: number) => stats.get(`${matchId}:${teamId}`)?.periods?.ft;
const avg = (values: Array<number | null | undefined>) => { const v = values.filter(finite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const fmt = (v: number | null, suffix = "") => v === null ? "—" : `${v.toFixed(1)}${suffix}`;

function Metric({ label, value, detail, icon: Icon = Gauge }: { label: string; value: string; detail: string; icon?: typeof Gauge }) {
  return <article className="panel team-analysis-advanced-metric"><Icon size={17} /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

export function TacticalProfileWorkspace({ data, teamId, season }: Props) {
  const { t } = useI18n();
  const [section, setSection] = useState<TacticalSection>("identity");
  const stats = useMemo(() => new Map(data.stats.map(r => [`${r.gameId}:${r.teamId}`, r])), [data.stats]);
  const matches = completed(data, teamId);
  const opponent = (m: Match) => m.homeId === teamId ? m.awayId : m.homeId;
  const own = (key: keyof PeriodStats) => { const value = avg(matches.map(m => rowFor(stats, m.id, teamId)?.[key])); return key === "possession" ? toPercent(value) : value; };
  const opp = (key: keyof PeriodStats) => { const value = avg(matches.map(m => rowFor(stats, m.id, opponent(m))?.[key])); return key === "possession" ? toPercent(value) : value; };
  const team = data.teams.find(x => x.id === teamId);
  const sections: Array<[TacticalSection, string]> = [["identity", t("teamAnalysis.tacticalIdentity")], ["strengths", t("teamAnalysis.strengths")], ["atlas", t("teamAnalysis.tacticalAtlas")], ["passing", "Passing & Progression"], ["sequences", "Possession Sequences"], ["attacking", "Attacking & Defending"], ["styles", "Playing Styles & Clusters"]];
  return <section className="team-analysis-advanced-workspace">
    <nav className="team-analysis-subtabs" role="tablist" aria-label={t("teamAnalysis.tacticalProfile")}>{sections.map(([id, label]) => <button key={id} className={section === id ? "active" : ""} role="tab" aria-selected={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
    {section === "identity" && <><div className="panel-heading"><div><span className="eyebrow">{t("teamAnalysis.tacticalProfile")}</span><h2>{t("teamAnalysis.tacticalIdentity")}</h2><p>{t("teamAnalysis.tacticalIdentityDescription")}</p></div></div><div className="team-analysis-advanced-grid"><Metric label={t("teamAnalysis.possession")} value={fmt(own("possession"), "%")} detail={`${matches.length} completed matches`} icon={Gauge} /><Metric label="Passing volume" value={fmt(own("passes"))} detail="attempts per match" icon={ArrowLeftRight} /><Metric label="Shot creation" value={fmt(own("shots"))} detail="shots per match" icon={Target} /><Metric label="Final-third progression" value={fmt(own("finalThirdPasses"))} detail="passes per match" icon={TrendingUp} /><Metric label="Defensive activity" value={fmt(own("tackles"))} detail="tackles per match" icon={Shield} /><Metric label="Ball recoveries" value={fmt(own("recoveries"))} detail="recoveries per match" icon={Swords} /></div><div className="team-analysis-methodology"><strong>Methodology</strong><span>Descriptive team averages from completed matches. Values are not subjective tactical ratings.</span></div></>}
    {section === "strengths" && <StrengthsWeaknesses data={data} teamId={teamId} season={season} />}
    {section === "atlas" && <div className="panel team-analysis-advanced-block"><h2>{t("teamAnalysis.tacticalAtlas")}</h2><p>Event-level season pitch bins are not present in the dashboard payload yet. The existing Match Report spatial-event pipeline can supply this gallery once season aggregates are precomputed.</p><div className="team-analysis-readiness"><CircleAlert size={18} /><span>Blocked by missing season-level spatial aggregation; no synthetic pitch data is rendered.</span></div><div className="team-analysis-atlas-grid">{data.teams.slice(0, 18).map(entry => <div className="team-analysis-atlas-team" key={entry.id}><strong>{entry.name}</strong><small>{entry.played} matches</small></div>)}</div></div>}
    {section === "passing" && <TacticalDNAPassing key={`${teamId}:${season}`} season={season} teamId={teamId} maxMatchday={Math.max(1, ...data.matches.map(match => match.week))} />}
    {section === "sequences" && <div className="panel team-analysis-advanced-block"><h2>Possession Sequences</h2><p>Match-level sequence collections exist, but the dashboard does not yet expose a season sequence aggregate. The sequence API remains available to Match Report and includes origin metadata.</p><div className="team-analysis-readiness"><CircleAlert size={18} /><span>Blocked until sequence summaries are aggregated by team, season and filter window.</span></div></div>}
    {section === "attacking" && <div className="panel team-analysis-advanced-block"><h2>Attacking &amp; Defending</h2><div className="team-analysis-advanced-grid"><Metric label="Shots" value={fmt(own("shots"))} detail="per match" icon={Target} /><Metric label="Shots on target" value={fmt(own("onTarget"))} detail="per match" icon={Crosshair} /><Metric label="Interceptions" value={fmt(own("interceptions"))} detail="per match" icon={Shield} /><Metric label="Recoveries" value={fmt(own("recoveries"))} detail="per match" icon={Swords} /><Metric label="Goals conceded" value={fmt(avg(matches.map(m => m.homeId === teamId ? m.awayGoals : m.homeGoals)))} detail="per match" icon={TrendingDown} /><Metric label="Opponent shots" value={fmt(opp("shots"))} detail="per match" icon={TrendingDown} /></div></div>}
    {section === "styles" && <div className="panel team-analysis-advanced-block"><h2>Playing Styles &amp; Clusters</h2><p>PCA, factor analysis and clustering are not trained because the current season-level feature matrix has not been materialized and 18 teams are insufficient for a stable single-season model.</p><div className="team-analysis-readiness"><Brain size={18} /><span>Model readiness: feature matrix and multi-season reference population required.</span></div><div className="team-analysis-advanced-grid"><Metric label="Selected team" value={team?.name ?? "—"} detail="current season profile" icon={Gauge} /><Metric label="Feature coverage" value="Pending" detail="validated tactical registry" icon={BarChart3} /></div></div>}
  </section>;
}

function StrengthsWeaknesses({ data, teamId }: Props) {
  const { t } = useI18n();
  const stats = useMemo(() => new Map(data.stats.map(r => [`${r.gameId}:${r.teamId}`, r])), [data.stats]);
  const matches = completed(data, teamId); const teams = data.teams; const get = (id: number, key: keyof PeriodStats) => avg(completed(data, id).map(m => rowFor(stats, m.id, id)?.[key]));
  const findings = [{ label: "Shot creation", key: "shots" as const, higher: true }, { label: "Pass completion", key: "passCompletion" as const, higher: true }, { label: "Ball recoveries", key: "recoveries" as const, higher: true }, { label: "Goals conceded", key: "goalsAgainst" as const, higher: false }].map(item => { const value = item.key === "goalsAgainst" ? avg(matches.map(m => m.homeId === teamId ? m.awayGoals : m.homeGoals)) : get(teamId, item.key); const league = teams.map(t => item.key === "goalsAgainst" ? avg(completed(data, t.id).map(m => m.homeId === t.id ? m.awayGoals : m.homeGoals)) : get(t.id, item.key)).filter(finite); const rank = value === null ? null : 1 + league.filter(v => item.higher ? v > value : v < value).length; return { ...item, value, rank, count: league.length }; });
  return <section className="team-analysis-advanced-block"><div className="panel-heading"><div><h2>{t("teamAnalysis.strengths")}</h2><p>Deterministic findings from available season statistics.</p></div></div><div className="team-analysis-finding-grid">{findings.map(f => <article className="panel team-analysis-finding" key={f.label}><strong>{f.label}</strong><span>{f.value === null ? "—" : f.value.toFixed(1)}</span><small>{f.rank ? `League rank #${f.rank}/${f.count}` : "Insufficient data"}</small><p>{f.rank === null ? "No league profile is available for this metric." : f.rank <= Math.ceil(Math.max(1, f.count) / 3) ? "Relative strength supported by the available sample." : f.rank && f.rank >= Math.floor(Math.max(1, f.count) * 2 / 3) ? "Relative weakness supported by the available sample." : "Middle-third league profile."}</p></article>)}</div></section>;
}

export function ForecastFoundation() { return <section className="team-analysis-advanced-block"><div className="panel-heading"><div><h2>Forecast</h2><p>Validated model outputs only.</p></div></div><div className="team-analysis-readiness"><CircleAlert size={18}/><span>No trained Elo, Poisson or Dixon–Coles artifact is currently available for this application. Probabilities are intentionally withheld.</span></div></section>; }


