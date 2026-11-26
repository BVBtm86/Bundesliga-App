import type { TacticalPeriod } from "./tactical-dna";

export const TACTICAL_PASSING_VERSION = 2;
export const PASS_PROGRESSION_METRES = 10;
export const PASS_GRID = { columns: 6, rows: 4 } as const;
const finalThird = 200 / 3;

type PassDirection = "forward" | "backward" | "lateral";
type Point = { x: number; y: number };
export type ImportedPassEvent = {
  game_id: number;
  event_idx: number;
  team_id: number;
  player_id?: number;
  player?: string;
  period: string;
  x?: number | null;
  y?: number | null;
  end_x?: number | null;
  end_y?: number | null;
  pass_completed?: boolean | number | null;
};
export type PassCounts = { attempts: number; completed: number; knownOutcomes: number };
export type PlayerPassing = PassCounts & { name: string | null; progressive: number; forward: number; entries: number };
export type EventPassingSummary = {
  direction: Record<PassDirection, PassCounts>;
  zones: Partial<Record<number, PassCounts>>;
  finalThirdEntries: number;
  progressive: PassCounts;
  players: Record<number, PlayerPassing>;
  usablePasses: number;
  rejectedPasses: number;
};

function location(x: unknown, y: unknown): Point | null {
  return typeof x === "number" && typeof y === "number" &&
    x >= 0 && x <= 100 && y >= 0 && y <= 100 ? { x, y } : null;
}

function passOutcome(value: ImportedPassEvent["pass_completed"]): boolean | null {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return null;
}

export function classifyTacticalPass(event: ImportedPassEvent, progressionMetres = PASS_PROGRESSION_METRES) {
  // The provider stores each team's attacking direction toward x=100 in both halves.
  const origin = location(event.x, event.y);
  const endpoint = location(event.end_x, event.end_y);
  if (!origin || !endpoint) return null;
  const goalDistance = (point: Point) => Math.hypot((100 - point.x) * 1.05, (50 - point.y) * 0.68);
  const progress = goalDistance(origin) - goalDistance(endpoint);
  const column = Math.min(PASS_GRID.columns - 1, Math.floor(origin.x * PASS_GRID.columns / 100));
  const row = Math.min(PASS_GRID.rows - 1, Math.floor(origin.y * PASS_GRID.rows / 100));
  const direction: PassDirection = endpoint.x > origin.x ? "forward" : endpoint.x < origin.x ? "backward" : "lateral";
  const completed = passOutcome(event.pass_completed);
  return {
    direction, completed, originZone: row * PASS_GRID.columns + column,
    finalThirdEntry: origin.x < finalThird && endpoint.x >= finalThird,
    progressive: progress >= progressionMetres
  };
}

function counts(): PassCounts {
  return { attempts: 0, completed: 0, knownOutcomes: 0 };
}

function increment(current: PassCounts, completed: boolean | null) {
  current.attempts++;
  if (completed !== null) current.knownOutcomes++;
  if (completed === true) current.completed++;
}

export function summarizeTacticalPassing(events: readonly ImportedPassEvent[], teamId: number, period: TacticalPeriod): EventPassingSummary | null {
  const directions = { forward: counts(), backward: counts(), lateral: counts() };
  const zones: EventPassingSummary["zones"] = {};
  const progressive = counts();
  const players: EventPassingSummary["players"] = {};
  let finalThirdEntries = 0;
  let usablePasses = 0;
  let rejectedPasses = 0;
  const seen = new Set<number>();
  for (const event of events) {
    if (event.team_id !== teamId || (event.period !== "FirstHalf" && event.period !== "SecondHalf") ||
        (period === "fh" && event.period !== "FirstHalf") || (period === "sh" && event.period !== "SecondHalf") ||
        !Number.isSafeInteger(event.event_idx) || seen.has(event.event_idx)) continue;
    seen.add(event.event_idx);
    const pass = classifyTacticalPass(event);
    if (event.player_id !== undefined && Number.isSafeInteger(event.player_id)) {
      const player = players[event.player_id] ??= {
        ...counts(), name: typeof event.player === "string" ? event.player : null, progressive: 0, forward: 0, entries: 0
      };
      increment(player, passOutcome(event.pass_completed));
      if (pass?.progressive) player.progressive++;
      if (pass?.direction === "forward") player.forward++;
      if (pass?.finalThirdEntry) player.entries++;
    }
    if (!pass) {
      rejectedPasses++;
      continue;
    }
    usablePasses++;
    increment(directions[pass.direction], pass.completed);
    increment(zones[pass.originZone] ??= counts(), pass.completed);
    if (pass.progressive) increment(progressive, pass.completed);
    if (pass.finalThirdEntry) finalThirdEntries++;
  }
  return seen.size ? { direction: directions, zones, finalThirdEntries, progressive, players, usablePasses, rejectedPasses } : null;
}
