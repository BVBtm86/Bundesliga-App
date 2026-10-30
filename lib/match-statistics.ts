import { completed } from "./analytics";
import { statsForPeriod } from "./filters";
import type { Match, MatchPeriod, MatchStats, VenueFilter } from "./types";

export type PreviewLens = "for" | "against";
export type PreviewCategory = "attack" | "defense" | "passing";
export type PreviewMetric = { label: string; percent?: boolean; home: number | null; away: number | null };

type Totals = Record<string, number>;
type Aggregated = { sampleSize: number; totals: Totals };
const number = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value : null;
const add = (totals: Totals, key: string, value: number | null | undefined) => { const safe = number(value); if (safe !== null) totals[key] = (totals[key] ?? 0) + safe; };
const average = (totals: Totals, key: string, sampleSize: number) => sampleSize > 0 && totals[key] !== undefined ? totals[key] / sampleSize : null;
const percentage = (totals: Totals, numerator: string, denominator: string) => totals[denominator] > 0 && totals[numerator] !== undefined ? totals[numerator] / totals[denominator] : null;

/**
 * Aggregates only fixtures completed before `before`.  `for` uses the selected
 * club's event record; `against` uses the record of its opponent in each fixture.
 * Percentages are always calculated from totals, never averaged per match.
 */
export function aggregatePreviewStatistics(
  matches: Match[], stats: MatchStats[], teamId: number,
  { lens, venue, period, before }: { lens: PreviewLens; venue: VenueFilter; period: MatchPeriod; before: string },
): Aggregated {
  const index = new Map(stats.map(row => [`${row.gameId}:${row.teamId}`, row]));
  const eligible = completed(matches).filter(match => {
    const plays = match.homeId === teamId || match.awayId === teamId;
    const venueMatches = venue === "all" || (venue === "home" ? match.homeId === teamId : match.awayId === teamId);
    return plays && venueMatches && new Date(match.date).getTime() < new Date(before).getTime();
  });
  const totals: Totals = {};
  for (const match of eligible) {
    const teamIsHome = match.homeId === teamId;
    const subjectId = lens === "for" ? teamId : teamIsHome ? match.awayId : match.homeId;
    const opponentId = subjectId === match.homeId ? match.awayId : match.homeId;
    const source = statsForPeriod(index.get(`${match.id}:${subjectId}`), period);
    const opponent = statsForPeriod(index.get(`${match.id}:${opponentId}`), period);
    const sourceGoals = period === "ft" ? (subjectId === match.homeId ? match.homeGoals : match.awayGoals) : source?.goals;
    const opponentGoals = period === "ft" ? (opponentId === match.homeId ? match.homeGoals : match.awayGoals) : opponent?.goals;
    add(totals, "goals", sourceGoals); add(totals, "goalsConceded", opponentGoals);
    add(totals, "shots", source?.shots); add(totals, "onTarget", source?.onTarget);
    add(totals, "shotsConceded", opponent?.shots); add(totals, "onTargetConceded", opponent?.onTarget);
    add(totals, "tackles", source?.tackles); add(totals, "successfulTackles", source?.successfulTackles); add(totals, "interceptions", source?.interceptions);
    add(totals, "possession", source?.possession); add(totals, "passes", source?.passes); add(totals, "completedPasses", source?.completedPasses);
    add(totals, "keyPasses", source?.keyPasses); add(totals, "finalThirdPasses", source?.finalThirdPasses); add(totals, "completedFinalThirdPasses", source?.completedFinalThirdPasses);
  }
  return { sampleSize: eligible.length, totals };
}

export function previewMetrics(home: Aggregated, away: Aggregated, category: PreviewCategory): PreviewMetric[] {
  const make = (label: string, key: string, percent = false): PreviewMetric => ({
    label, percent,
    home: percent && key.includes("/") ? percentage(home.totals, key.split("/")[0], key.split("/")[1]) : average(home.totals, key, home.sampleSize),
    away: percent && key.includes("/") ? percentage(away.totals, key.split("/")[0], key.split("/")[1]) : average(away.totals, key, away.sampleSize),
  });
  if (category === "attack") return [
    make("Goals per match", "goals"), make("Shots per match", "shots"), make("Shots on target per match", "onTarget"),
    make("Shot accuracy", "onTarget/shots", true), make("Goal conversion", "goals/shots", true),
  ];
  if (category === "defense") return [
    make("Goals conceded per match", "goalsConceded"), make("Shots conceded per match", "shotsConceded"), make("Shots on target conceded per match", "onTargetConceded"),
    make("Successful tackles per match", "successfulTackles"), make("Interceptions per match", "interceptions"),
  ];
  return [
    make("Possession", "possession", true), make("Pass completion", "completedPasses/passes", true), make("Successful passes per match", "completedPasses"),
    make("Key passes per match", "keyPasses"), make("Final-third pass completion", "completedFinalThirdPasses/finalThirdPasses", true),
  ];
}
