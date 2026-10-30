"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { Dashboard, Match } from "@/lib/types";
import { standings } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";
import type { ScatterFilters } from "./team-analysis-scatter";
import { TEAM_ANALYSIS_METRICS, type TeamAnalysisCategory, type TeamAnalysisMetricKey } from "./team-analysis-metrics";
import { isRatioMetric, metricValue, periodRow } from "./team-analysis-value";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const percentage = (value: number | null | undefined) => finite(value) ? (value <= 1 ? value * 100 : value) : null;

type MetricValue = { value: number | null; league: number | null; rank: number | null; eligible: number; scale: number | null; marker: number | null };

export default function TeamAnalysisStatisticalPerformance({ data, teamId, filters, category }: { data: Dashboard; teamId: number; filters: ScatterFilters; category: TeamAnalysisCategory }) {
  const { t } = useI18n();
  const matches = data.matches.filter((match) => match.finished && Number.isInteger(match.homeGoals) && Number.isInteger(match.awayGoals) && match.week >= filters.from && match.week <= Math.max(filters.from, filters.to));
  const stats = new Map(data.stats.map((row) => [`${row.gameId}:${row.teamId}`, row]));
  const seasonConfig = data.seasonConfigs?.find(config => config.season === data.season);
  const teams = standings(matches, filters.venue, data.matches, seasonConfig?.rules?.pointsForWin ?? 3, seasonConfig?.standingsTiebreakers, seasonConfig?.rules?.pointsForDraw ?? 1, seasonConfig);

  const raw = (match: Match, id: number, key: TeamAnalysisMetricKey, against = false): number | null => {
    const home = match.homeId === id;
    if (!home && match.awayId !== id) return null;
    if ((filters.venue === "home" && !home) || (filters.venue === "away" && home)) return null;
    const opponent = home ? match.awayId : match.homeId;
    const source = against ? opponent : id;
    const { row, opponent: opponentRow } = periodRow(stats, match, source, filters.period);
    const ownGoals = home ? match.homeGoals : match.awayGoals;
    const opponentGoals = home ? match.awayGoals : match.homeGoals;
    if (key === "goals") return filters.period === "ft" ? (against ? opponentGoals : ownGoals) : finite(row?.goals) ? row!.goals! : null;
    if (!row) return null;
    return metricValue(match, row, opponentRow, key, against);
  };

  const average = (id: number, key: TeamAnalysisMetricKey, against: boolean): number | null => {
    if (isRatioMetric(key)) {
      let saves = 0;
      let faced = 0;
      for (const match of matches) {
        const home = match.homeId === id;
        if (!home && match.awayId !== id) continue;
        if ((filters.venue === "home" && !home) || (filters.venue === "away" && home)) continue;
        const opponent = home ? match.awayId : match.homeId;
        const sourceId = against ? opponent : id;
        const facedId = against ? id : opponent;
        const source = stats.get(`${match.id}:${sourceId}`)?.periods?.[filters.period];
        const facedRow = stats.get(`${match.id}:${facedId}`)?.periods?.[filters.period];
        if (key === "savePercentage" && finite(source?.saves) && finite(facedRow?.onTarget) && facedRow!.onTarget! > 0) {
          saves += source!.saves!; faced += facedRow!.onTarget!;
        }
      }
      if (key === "savePercentage") return faced > 0 ? (saves / faced) * 100 : null;
      const numeratorKey: Record<string, string> = { shotAccuracy: "onTarget", goalConversion: "goals", passAccuracy: "completedPasses", tackleSuccess: "successfulTackles", longPassAccuracy: "completedLongPasses", crossCompletion: "completedCrosses", finalThirdCompletion: "completedFinalThirdPasses" };
      const denominatorKey: Record<string, string> = { shotAccuracy: "shots", goalConversion: "shots", passAccuracy: "passes", tackleSuccess: "tackles", longPassAccuracy: "longPasses", crossCompletion: "crosses", finalThirdCompletion: "finalThirdPasses" };
      let numerator = 0, denominator = 0;
      for (const match of matches) { const home = match.homeId === id; if (!home && match.awayId !== id) continue; if ((filters.venue === "home" && !home) || (filters.venue === "away" && home)) continue; const sourceId = against ? (home ? match.awayId : match.homeId) : id; const row = stats.get(`${match.id}:${sourceId}`)?.periods?.[filters.period] as any; const n = row?.[numeratorKey[key] as string], d = row?.[denominatorKey[key] as string]; if (finite(n) && finite(d) && d > 0) { numerator += n; denominator += d; } }
      return denominator > 0 ? numerator / denominator * 100 : null;
    }
    const values = matches.map((match) => raw(match, id, key, against)).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  const rank = (key: TeamAnalysisMetricKey, id: number, against: boolean): number | null => {
    const selected = average(id, key, against);
    const values = teams.map((team) => average(team.id, key, against)).filter((value): value is number => finite(value));
    if (selected === null || !values.length) return null;
    const lowerIsBetter = against ? !["yellowCards", "foulsSuffered", "saves", "savePercentage"].includes(key) : ["yellowCards", "redCards", "fouls", "offsides"].includes(key);
    return 1 + values.filter((value) => lowerIsBetter ? value < selected : value > selected).length;
  };

  const metricData = (metric: (typeof TEAM_ANALYSIS_METRICS[TeamAnalysisCategory])[number]): { for: MetricValue; against: MetricValue; visible: boolean } => {
    const values = [false, true].map((against) => teams.map((team) => average(team.id, metric.key, against)).filter((value): value is number => finite(value)));
    const scales = metric.unit === "percent" ? [100, 100] : [Math.max(0, ...values.flat()), Math.max(0, ...values.flat())];
    const make = (against: boolean, index: number): MetricValue => {
      const eligible = values[index];
      const value = average(teamId, metric.key, against);
      const league = eligible.length ? eligible.reduce((sum, item) => sum + item, 0) / eligible.length : null;
      const ranking = rank(metric.key, teamId, against);
      const scale = scales[index] > 0 ? scales[index] : null;
      return { value, league, rank: ranking, eligible: eligible.length, scale, marker: league !== null && scale ? (league / scale) * 100 : null };
    };
    return { for: make(false, 0), against: make(true, 1), visible: values.some((items) => items.length > 0) };
  };

  const format = (value: number | null, unit: string) => value === null ? "—" : unit === "percent" ? `${value.toFixed(1)}%` : value.toFixed(2);
  const metrics = TEAM_ANALYSIS_METRICS[category].map((metric) => ({ metric, data: metricData(metric) })).filter((entry) => entry.data.visible);

  const renderCard = (against: boolean) => (
    <section className={`panel team-analysis-stat-card ${against ? "against" : "for"}`}>
      <div className="team-analysis-stat-card-heading">
        <h2>{against ? t("teamAnalysis.against") : t("teamAnalysis.for")} {against ? <TrendingDown size={20} /> : <TrendingUp size={20} />}</h2>
        <span className="team-analysis-card-legend"><i aria-hidden="true" />{t("teamAnalysis.leagueAverage")}</span>
      </div>
      <div className="team-analysis-stat-card-table">
        <div className="head"><span>{t("teamAnalysis.metric")}</span><span>{t("teamAnalysis.team")}</span><span>{t("teamAnalysis.leagueRank")}</span></div>
        {metrics.map(({ metric, data: metricValues }) => {
          const current = against ? metricValues.against : metricValues.for;
          const bar = current.value !== null && current.scale ? Math.min(100, Math.max(0, (current.value / current.scale) * 100)) : 0;
          return <div className="row" key={metric.key}>
            <div className="metric-name"><span>{t(metric.labelKey)}</span></div>
            <strong>{format(current.value, metric.unit)}</strong>
            <small>{current.rank === null ? "—" : `#${current.rank}/${current.eligible}`}</small>
            <i className="team-analysis-performance-track" title={current.league === null ? t("teamAnalysis.noData") : `${t("teamAnalysis.leagueAverage")}: ${format(current.league, metric.unit)}`} aria-label={current.league === null ? t("teamAnalysis.noData") : `${t("teamAnalysis.leagueAverage")}: ${format(current.league, metric.unit)}`}>
              <b style={{ width: `${bar}%` }} /><em style={{ left: `${current.marker ?? 0}%` }} />
            </i>
          </div>;
        })}
      </div>
    </section>
  );

  return <section className="team-analysis-statistical-performance"><div className="panel-heading compact"><div><span className="eyebrow">{t("teamAnalysis.statisticalPerformance")}</span><h2>{t("teamAnalysis.statisticalPerformance")}</h2></div></div><div className="team-analysis-statistical-cards">{renderCard(false)}{renderCard(true)}</div></section>;
}

