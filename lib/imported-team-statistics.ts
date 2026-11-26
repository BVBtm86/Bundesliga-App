import { PERIODS } from "./filters";
import type { MatchStats, MatchPeriod, PeriodStats } from "./types";

const fields = {
  goals: "goals",
  ownGoals: "own_goals",
  shots: "shots",
  shotsOffTarget: "shot_off_target",
  blockedShots: "shot_blocked",
  woodwork: "shot_woodwork",
  onTarget: "shot_on_target",
  insideBoxShots: "shot_zone_inside_box",
  outsideBoxShots: "shot_zone_outside_box",
  setPieceShots: "shot_set_piece",
  fastbreakShots: "shot_fastbreak",
  openPlayShots: "shot_open_play",
  penaltyShots: "shot_penalty",
  possession: "possession",
  touches: "touches",
  lossOfPossession: "loss_of_possession",
  dispossessed: "dispossessed",
  turnovers: "turnover",
  passes: "pass_attempt",
  completedPasses: "pass_completed",
  passCompletion: "pass_completion_pct",
  keyPasses: "pass_key_pass",
  assists: "pass_assist",
  throughBalls: "pass_through_ball",
  forwardPasses: "pass_forward",
  backwardPasses: "pass_backward",
  crosses: "pass_cross",
  completedCrosses: "pass_cross_completed",
  crossCompletion: "pass_cross_completion_pct",
  longPasses: "pass_long",
  completedLongPasses: "pass_long_completed",
  longPassAccuracy: "pass_long_completion_pct",
  finalThirdPasses: "pass_final_third",
  completedFinalThirdPasses: "pass_final_third_completed",
  finalThirdCompletion: "pass_final_third_completion_pct",
  corners: "pass_corner",
  tackles: "tackles_attempted",
  successfulTackles: "tackle_gained_possession",
  tackleSuccess: "tackle_success_pct",
  interceptions: "interceptions",
  clearances: "clearances",
  blocks: "blocks",
  blockedShot: "blocked_shot",
  errors: "errors",
  recoveries: "ball_recoveries",
  dribbles: "dribbles",
  successfulDribbles: "dribble_successful",
  offsides: "offsides",
  foulsWon: "foul_suffered",
  foulsCommitted: "foul_committed",
  aerialDuels: "aerial_duels",
  aerialDuelsWon: "aerial_duel_won",
  saves: "saves",
  goalkeeperActions: "goalkeeper_actions",
  claims: "claims",
  punches: "punches",
  keeperPickup: "keeper_pickup",
  keeperSweeper: "keeper_sweeper",
  secondYellowCards: "second_yellow_card",
  foulsSuffered: "foul_suffered",
  redCards: "red_card",
  shotAccuracy: "shot_accuracy",
  goalConversion: "goal_conversion_pct",
} as const satisfies Partial<Record<keyof PeriodStats, string>>;

const sourceFields = [...new Set([...Object.values(fields), "cards", "yellow_card"])];
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

export function importedTeamStatsProjection(periods: readonly MatchPeriod[] = PERIODS.map(period => period.value)) {
  return Object.fromEntries([
    ["_id", 0], ["game_id", 1], ["team_id", 1],
    ...periods.flatMap(period => sourceFields.map(field => [`stats.${period}.${field}`, 1]))
  ]);
}

export type ImportedTeamStats = {
  game_id: number;
  team_id: number;
  stats?: Partial<Record<MatchPeriod, Record<string, unknown>>>;
};

export function normalizeImportedTeamStats(document: ImportedTeamStats): MatchStats {
  const periods: MatchStats["periods"] = {};
  for (const { value } of PERIODS) {
    const raw = document.stats?.[value];
    if (!raw) continue;
    const mapped = Object.fromEntries(Object.entries(fields).map(([metric, source]) => [metric, asNumber(raw[source])]));
    periods[value] = { ...mapped, yellowCards: asNumber(raw.cards ?? raw.yellow_card) } as PeriodStats;
  }
  const ft = periods.ft;
  return {
    ...ft, gameId: document.game_id, teamId: document.team_id, periods,
    shots: ft?.shots ?? null, onTarget: ft?.onTarget ?? null, possession: ft?.possession ?? null,
    passes: ft?.passes ?? null, passCompletion: ft?.passCompletion ?? null
  };
}
