import type { Match, MatchPeriod, MatchStats, PeriodStats } from "./types";

export const TACTICAL_DNA_VERSION = 1;
export const TACTICAL_PERIODS = ["ft", "fh", "sh"] as const satisfies readonly MatchPeriod[];
export type TacticalPeriod = typeof TACTICAL_PERIODS[number];

export type TacticalScope = {
  season: string;
  from: number;
  to: number;
  venue: "home" | "away" | "all";
  period: TacticalPeriod;
};

type SourceFields = readonly [keyof PeriodStats, (keyof PeriodStats)?];
type Feature = {
  label: string;
  source: "game_team_stats_app";
  definition: string;
  unit: "%" | "per match";
  fields: SourceFields;
  aggregation: "mean" | "ratio";
  minimumMatches: number;
  seasonCoverage: "observed";
  version: number;
};

function feature(label: string, definition: string, fields: SourceFields, aggregation: Feature["aggregation"] = "mean", unit: Feature["unit"] = "per match"): Feature {
  return { label, source: "game_team_stats_app", definition, unit, fields, aggregation, minimumMatches: 1, seasonCoverage: "observed", version: TACTICAL_DNA_VERSION };
}

export const TACTICAL_FEATURES = {
  possession: feature("Possession", "Mean of the provider’s possession shares over covered matches.", ["possession"], "mean", "%"),
  passAttempts: feature("Pass attempts", "Mean recorded pass attempts.", ["passes"]),
  completedPasses: feature("Successful passes", "Mean recorded completed passes.", ["completedPasses"]),
  passCompletion: feature("Pass completion", "Total completed passes divided by total attempts over matches with both fields.", ["completedPasses", "passes"], "ratio", "%"),
  forwardPasses: feature("Forward passes", "Mean provider-classified forward pass attempts.", ["forwardPasses"]),
  backwardPasses: feature("Backward passes", "Mean provider-classified backward pass attempts.", ["backwardPasses"]),
  forwardPassShare: feature("Forward pass percentage", "Total provider-classified forward attempts divided by total attempts over matches with both fields.", ["forwardPasses", "passes"], "ratio", "%"),
  longPassShare: feature("Long-pass percentage", "Total provider-classified long attempts divided by total attempts over matches with both fields.", ["longPasses", "passes"], "ratio", "%"),
  finalThirdPasses: feature("Final-third passes", "Mean provider-classified final-third passes, including passes originating inside the final third.", ["finalThirdPasses"]),
  shots: feature("Shots", "Mean recorded shot attempts.", ["shots"]),
  shotsOnTarget: feature("Shots on target", "Mean recorded shots on target.", ["onTarget"]),
  shotAccuracy: feature("Shot accuracy", "Total shots on target divided by total shot attempts over matches with both fields.", ["onTarget", "shots"], "ratio", "%"),
  goals: feature("Goals", "Mean goals recorded in team statistics for the selected period.", ["goals"]),
  goalConversion: feature("Goal conversion", "Total goals recorded in team statistics divided by total shots over matches with both fields.", ["goals", "shots"], "ratio", "%"),
  insideBoxShots: feature("Shots inside the box", "Mean provider-classified shots from inside the penalty area.", ["insideBoxShots"]),
  outsideBoxShots: feature("Shots outside the box", "Mean provider-classified shots from outside the penalty area.", ["outsideBoxShots"]),
  recoveries: feature("Ball recoveries", "Mean recorded recoveries.", ["recoveries"]),
  interceptions: feature("Interceptions", "Mean recorded interceptions.", ["interceptions"]),
  tackles: feature("Tackles", "Mean recorded tackle attempts.", ["tackles"]),
  clearances: feature("Clearances", "Mean recorded clearances.", ["clearances"]),
  blocks: feature("Blocks", "Mean recorded blocks.", ["blocks"]),
};

export type TacticalFeature = keyof typeof TACTICAL_FEATURES;
const featureKeys = Object.keys(TACTICAL_FEATURES) as TacticalFeature[];
type Contribution = { numerator: number; denominator: number };
export type TacticalTeamMatch = {
  matchId: number;
  teamId: number;
  season: string;
  matchday: number;
  venue: "home" | "away";
  period: TacticalPeriod;
  version: number;
  team: Partial<Record<TacticalFeature, Contribution>>;
  opponent: Partial<Record<TacticalFeature, Contribution>>;
};
export type TacticalMetric = { value: number | null; matches: number };

function valid(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function contributions(row: PeriodStats | undefined): TacticalTeamMatch["team"] {
  const entries: TacticalTeamMatch["team"] = {};
  for (const key of featureKeys) {
    const { fields: [field, divisor] } = TACTICAL_FEATURES[key];
    const numerator = row?.[field];
    const denominator = divisor ? row?.[divisor] : 1;
    if (!valid(numerator) || !valid(denominator) || (divisor && numerator > denominator)) continue;
    if (key === "possession" && numerator > 100) continue;
    entries[key] = { numerator: key === "possession" && numerator <= 1 ? numerator * 100 : numerator, denominator };
  }
  return entries;
}

export function buildTacticalTeamMatches(match: Pick<Match, "id" | "season" | "week" | "finished" | "historical" | "homeGoals" | "awayGoals" | "homeId" | "awayId">, statistics: readonly MatchStats[]): TacticalTeamMatch[] {
  if (!match.finished || match.historical || match.homeGoals === null || match.awayGoals === null ||
      !/^\d{4}-\d{4}$/.test(match.season ?? "") || match.season! < "2009-2010") return [];

  const statsByTeam = new Map(statistics.filter(row => row.gameId === match.id).map(row => [row.teamId, row]));
  const records: TacticalTeamMatch[] = [];
  for (const period of TACTICAL_PERIODS) {
    const home = contributions(statsByTeam.get(match.homeId)?.periods?.[period]);
    const away = contributions(statsByTeam.get(match.awayId)?.periods?.[period]);
    records.push(
      { matchId: match.id, teamId: match.homeId, season: match.season!, matchday: match.week, venue: "home", period, version: TACTICAL_DNA_VERSION, team: home, opponent: away },
      { matchId: match.id, teamId: match.awayId, season: match.season!, matchday: match.week, venue: "away", period, version: TACTICAL_DNA_VERSION, team: away, opponent: home }
    );
  }
  return records;
}

export function aggregateTacticalScope(records: readonly TacticalTeamMatch[], scope: TacticalScope, metric: TacticalFeature, side: "team" | "opponent" = "team"): Map<number, TacticalMetric> {
  const teams = new Map<number, Contribution & { matches: number }>();
  const seen = new Set<string>();
  for (const row of records) {
    if (row.season !== scope.season || row.period !== scope.period || row.version !== TACTICAL_DNA_VERSION ||
        row.matchday < scope.from || row.matchday > scope.to || (scope.venue !== "all" && row.venue !== scope.venue)) continue;
    const identity = `${row.matchId}:${row.teamId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const totals = teams.get(row.teamId) ?? { numerator: 0, denominator: 0, matches: 0 };
    const contribution = row[side][metric];
    if (contribution) {
      totals.numerator += contribution.numerator;
      totals.denominator += contribution.denominator;
      totals.matches++;
    }
    teams.set(row.teamId, totals);
  }
  const feature = TACTICAL_FEATURES[metric];
  return new Map([...teams].map(([id, { numerator, denominator, matches }]) => [id, {
    value: matches >= feature.minimumMatches && denominator > 0 ? numerator / denominator * (feature.aggregation === "ratio" ? 100 : 1) : null,
    matches
  }]));
}

export function tacticalLeaguePosition(metrics: ReadonlyMap<number, TacticalMetric>, teamId: number) {
  const values = [...metrics.values()].flatMap(metric => metric.value === null ? [] : [metric.value]);
  const selected = metrics.get(teamId)?.value ?? null;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  if (selected === null) return { average, rank: null, percentile: null, eligibleTeams: values.length };
  const higher = values.filter(value => value > selected).length;
  const lower = values.filter(value => value < selected).length;
  return {
    average,
    rank: higher + 1,
    percentile: (lower + (values.length - higher - lower) / 2) / values.length * 100,
    eligibleTeams: values.length
  };
}
