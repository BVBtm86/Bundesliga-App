/**
 * Frontend contract for a prediction service. It intentionally contains no
 * implementation details from the future Python/FastAPI model layer.
 */
export type PredictionStatus = "available" | "pending" | "unavailable" | "stale";

export interface MatchPrediction {
  matchId: number;
  model: { name: string; version: string };
  generatedAt: string;
  status: PredictionStatus;
  result?: { homeWin: number; draw: number; awayWin: number };
  goals?: {
    expectedHome: number; expectedAway: number;
    over15: number; over25: number; over35: number; bothTeamsToScore: number;
    likelyScorelines: Array<{ home: number; away: number; probability: number }>;
  };
  corners?: { expectedTotal: number; over85: number; over95: number; over105: number };
  shots?: { expectedHome: number; expectedAway: number; onTargetHome: number; onTargetAway: number };
}

/** Future FastAPI resource; no request is made until the service exists. */
export const predictionEndpoint = (matchId: number) => `/api/matches/${matchId}/predictions`;
