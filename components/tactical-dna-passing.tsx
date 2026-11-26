"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, CircleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  TACTICAL_FEATURES,
  type TacticalFeature,
  type TacticalMetric,
  type TacticalPeriod,
  type TacticalScope
} from "@/lib/tactical-dna";

import TacticalPassingDistribution, { type PassingDistribution } from "./tactical-passing-distribution";

const passingMetrics = [
  "passAttempts", "completedPasses", "passCompletion", "forwardPasses",
  "backwardPasses", "longPassShare", "finalThirdPasses"
] as const satisfies readonly TacticalFeature[];

type TeamSummary = { teamId: number; matches: number; passing?: PassingDistribution | null; metrics: Partial<Record<TacticalFeature, TacticalMetric>> };
type LoadResult = { request: string; team: TeamSummary | null; error: boolean };

export default function TacticalDNAPassing({ season, teamId, maxMatchday }: {
  season: string;
  teamId: number;
  maxMatchday: number;
}) {
  const { locale, t } = useI18n();
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(maxMatchday);
  const [venue, setVenue] = useState<TacticalScope["venue"]>("all");
  const [period, setPeriod] = useState<TacticalPeriod>("ft");
  const [result, setResult] = useState<LoadResult | null>(null);
  const finalDay = Math.min(end, maxMatchday);
  const firstDay = Math.min(start, finalDay);
  const matchdays = Array.from({ length: maxMatchday }, (_, index) => index + 1);
  const request = new URLSearchParams({
    season, start: String(firstDay), end: String(finalDay), venue, period
  }).toString();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tactical-dna/metrics?${request}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Tactical DNA request failed");
        return await response.json() as { teams: TeamSummary[] };
      })
      .then(({ teams }) => {
        if (!controller.signal.aborted) setResult({ request, team: teams.find(team => team.teamId === teamId) ?? null, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ request, team: null, error: true });
      });
    return () => controller.abort();
  }, [request, teamId]);

  const current = result?.request === request ? result : null;
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const team = current?.team;
  const hasMetrics = passingMetrics.some(key => team?.metrics[key]?.value != null);

  return <section className="panel team-analysis-advanced-block">
    <div className="panel-heading">
      <div>
        <h2>Passing &amp; Progression</h2>
        {team && <p>{t("teamAnalysis.sampleSize", {count: team.matches})}</p>}
      </div>
    </div>
    <div className="team-analysis-shared-filters">
      <label>{t("filters.fromMatchday")}
        <select value={firstDay} onChange={event => {
          const value = Number(event.target.value);
          setStart(value);
          setEnd(Math.max(finalDay, value));
        }}>{matchdays.map(day => <option key={day}>{day}</option>)}</select>
      </label>
      <label>{t("filters.toMatchday")}
        <select value={finalDay} onChange={event => {
          const value = Number(event.target.value);
          setEnd(value);
          setStart(Math.min(firstDay, value));
        }}>{matchdays.map(day => <option key={day}>{day}</option>)}</select>
      </label>
      <label>{t("filters.venue")}
        <select value={venue} onChange={event => setVenue(event.target.value as TacticalScope["venue"])}>
          <option value="all">{t("filters.allVenues")}</option>
          <option value="home">{t("filters.home")}</option>
          <option value="away">{t("filters.away")}</option>
        </select>
      </label>
      <label>{t("filters.matchPeriod")}
        <select value={period} onChange={event => setPeriod(event.target.value as TacticalPeriod)}>
          <option value="ft">{t("ui.fullMatch")}</option>
          <option value="fh">{t("ui.firstHalf")}</option>
          <option value="sh">{t("ui.secondHalf")}</option>
        </select>
      </label>
    </div>
    {!current ? <p className="team-analysis-empty" role="status">{t("teamAnalysis.loadingSeason")}</p> :
      current.error ? <p className="team-analysis-empty" role="alert"><CircleAlert /> Passing statistics are temporarily unavailable.</p> :
      !hasMetrics ? <p className="team-analysis-empty" role="status">No passing statistics are available for these filters.</p> :
      <div className="team-analysis-advanced-grid">
        {passingMetrics.map(key => {
          const feature = TACTICAL_FEATURES[key];
          const metric = team?.metrics[key];
          return <article className="panel team-analysis-advanced-metric" key={key}>
            <ArrowLeftRight size={17} aria-hidden="true" />
            <div>
              <span>{feature.label} {feature.unit === "per match" ? "per match" : ""}</span>
              <strong>{metric?.value == null ? "—" : formatter.format(metric.value) + (feature.unit === "%" ? "%" : "")}</strong>
              <small>{t("teamAnalysis.sampleSize", {count: metric?.matches ?? 0})}</small>
              <small>{feature.definition}</small>
            </div>
          </article>;
        })}
      </div>}
    {team?.passing && team.passing.usablePasses > 0 &&
      <TacticalPassingDistribution key={request} passing={team.passing} locale={locale} />}
  </section>;
}
