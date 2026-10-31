import { standings } from "./analytics";
import type { Match, SeasonConfig } from "./types";

export type HistoricalPosition = {
  season: string;
  clubId: number;
  clubName: string;
  position: number;
  participants: number;
  status: "bundesliga";
  champion: boolean;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

/**
 * Builds positions only for seasons whose imported results form a complete
 * Bundesliga round robin. The configured points system is passed through so
 * pre-1995 seasons use two points for a win where configured.
 */
export function buildHistoricalPositions(seasons: string[], matches: Match[], configs: SeasonConfig[]): HistoricalPosition[] {
  return seasons.flatMap(season => {
    const seasonMatches = matches.filter(match => match.season === season && match.finished && match.homeGoals !== null && match.awayGoals !== null);
    const config = configs.find(item => item.season === season);
    const table = standings(
      seasonMatches,
      "all",
      [],
      config?.rules?.pointsForWin ?? 3,
      config?.standingsTiebreakers,
      config?.rules?.pointsForDraw ?? 1,
      config,
    );
    const participants = config?.teamCount ?? table.length;
    const expectedMatches = participants * (participants - 1);
    const complete = table.length > 1 && table.length === participants && seasonMatches.length >= expectedMatches;
    if (!complete) return [];
    return table.map((row, index) => ({
      season,
      clubId: row.id,
      clubName: row.name,
      position: index + 1,
      participants,
      status: "bundesliga" as const,
      champion: index === 0,
      points: row.points,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.gf,
      goalsAgainst: row.ga,
      goalDifference: row.gf - row.ga,
    }));
  });
}
