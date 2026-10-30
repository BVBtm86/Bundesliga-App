import type { Match, MatchPeriod, MatchStats, PeriodStats } from "@/lib/types";
import type { TeamAnalysisMetricKey } from "./team-analysis-metrics";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const toPercent = (v: number | null | undefined) => finite(v) ? (v <= 1 ? v * 100 : v) : null;
export const weightedPercent = (numerator: number | null | undefined, denominator: number | null | undefined) => finite(numerator) && finite(denominator) && denominator > 0 ? numerator / denominator * 100 : null;

const ratioKeys = new Set<TeamAnalysisMetricKey>(["shotAccuracy", "goalConversion", "passAccuracy", "tackleSuccess", "longPassAccuracy", "crossCompletion", "finalThirdCompletion", "savePercentage"]);
export const isRatioMetric = (key: TeamAnalysisMetricKey) => ratioKeys.has(key);
export const ratioParts = (row: PeriodStats | undefined, opponent: PeriodStats | undefined, key: TeamAnalysisMetricKey) => {
  if (!row) return null;
  if (key === "savePercentage") return finite(row.saves) && finite(opponent?.onTarget) ? { numerator: row.saves!, denominator: opponent!.onTarget! } : null;
  const pairs: Record<string, [keyof PeriodStats, keyof PeriodStats]> = {
    shotAccuracy: ["onTarget", "shots"], goalConversion: ["goals", "shots"], passAccuracy: ["completedPasses", "passes"], tackleSuccess: ["successfulTackles", "tackles"],
    longPassAccuracy: ["completedLongPasses", "longPasses"], crossCompletion: ["completedCrosses", "crosses"], finalThirdCompletion: ["completedFinalThirdPasses", "finalThirdPasses"],
  };
  const pair = pairs[key]; if (!pair) return null;
  const numerator = row[pair[0]], denominator = row[pair[1]];
  return finite(numerator) && finite(denominator) ? { numerator, denominator } : null;
};

export function metricValue(match: Match, row: PeriodStats | undefined, opponent: PeriodStats | undefined, key: TeamAnalysisMetricKey, against: boolean): number | null {
  if (!row) return null;
  if (key === "possession") return toPercent(row.possession);
  if (key === "shotAccuracy") return finite(row.shots) && row.shots! > 0 && finite(row.onTarget) ? row.onTarget! / row.shots! * 100 : null;
  if (key === "goalConversion") return finite(row.shots) && row.shots! > 0 && finite(row.goals) ? row.goals! / row.shots! * 100 : null;
  if (key === "passAccuracy") return finite(row.passes) && row.passes! > 0 && finite(row.completedPasses) ? row.completedPasses! / row.passes! * 100 : null;
  if (key === "tackleSuccess") return finite(row.tackles) && row.tackles! > 0 && finite(row.successfulTackles) ? row.successfulTackles! / row.tackles! * 100 : null;
  if (key === "longPassAccuracy") return finite(row.longPasses) && row.longPasses! > 0 && finite(row.completedLongPasses) ? row.completedLongPasses! / row.longPasses! * 100 : null;
  if (key === "crossCompletion") return finite(row.crosses) && row.crosses! > 0 && finite(row.completedCrosses) ? row.completedCrosses! / row.crosses! * 100 : null;
  if (key === "finalThirdCompletion") return finite(row.finalThirdPasses) && row.finalThirdPasses! > 0 && finite(row.completedFinalThirdPasses) ? row.completedFinalThirdPasses! / row.finalThirdPasses! * 100 : null;
  if (key === "savePercentage") return finite(row.saves) && finite(opponent?.onTarget) && opponent!.onTarget! > 0 ? row.saves! / opponent!.onTarget! * 100 : null;
  const values: Partial<Record<TeamAnalysisMetricKey, number | null | undefined>> = {
    ownGoals: row.ownGoals, shots: row.shots, onTarget: row.onTarget, shotsOffTarget: row.shotsOffTarget, blockedShots: row.blockedShots, woodwork: row.woodwork,
    corners: row.corners, insideBoxShots: row.insideBoxShots, outsideBoxShots: row.outsideBoxShots, openPlayShots: row.openPlayShots, fastbreakShots: row.fastbreakShots, setPieceShots: row.setPieceShots, penaltyShots: row.penaltyShots,
    dribbles: row.dribbles, successfulDribbles: row.successfulDribbles, interceptions: row.interceptions, tackles: row.tackles, successfulTackles: row.successfulTackles,
    recoveries: row.recoveries, clearances: row.clearances, blocks: row.blocks, blockedShot: row.blockedShot, errors: row.errors, aerialDuels: row.aerialDuels, aerialDuelsWon: row.aerialDuelsWon,
    passes: row.passes, successfulPasses: row.completedPasses, keyPasses: row.keyPasses, assists: row.assists, throughBalls: row.throughBalls, crosses: row.crosses, longPasses: row.longPasses, finalThirdPasses: row.finalThirdPasses, forwardPasses: row.forwardPasses, backwardPasses: row.backwardPasses,
    touches: row.touches, lossOfPossession: row.lossOfPossession, dispossessed: row.dispossessed, turnovers: row.turnovers,
    yellowCards: row.yellowCards, secondYellowCards: row.secondYellowCards, redCards: row.redCards, fouls: row.foulsCommitted, foulsSuffered: row.foulsSuffered, offsides: row.offsides,
    saves: row.saves, goalkeeperActions: row.goalkeeperActions, claims: row.claims, punches: row.punches, keeperPickup: row.keeperPickup, keeperSweeper: row.keeperSweeper,
  };
  return finite(values[key]) ? values[key]! : null;
}

export function periodRow(stats: Map<string, MatchStats>, match: Match, teamId: number, period: MatchPeriod) {
  const row = stats.get(`${match.id}:${teamId}`)?.periods?.[period];
  const opponentId = match.homeId === teamId ? match.awayId : match.homeId;
  const opponent = stats.get(`${match.id}:${opponentId}`)?.periods?.[period];
  return { row, opponent };
}
