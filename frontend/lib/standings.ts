export type TableType = "Total" | "Home" | "Away";
export type ViewKey = "overview" | "advanced" | "form";

export type StandingTeam = {
  team_id: number;
  team_name: string;
  display_name: string;
  team_logo?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  rank: number;
  form: string[];
  form_history: string[];
  form_matches?: {
    result: string;
    goals_for: number;
    goals_against: number;
  }[];
  zone: "champion" | "champions_league" | "europe" | "playoff" | "relegation" | "midtable";
};

export type StandingsPayload = {
  database: string;
  season: string;
  table_type: TableType;
  round_filter: string;
  matchweek_filter: string;
  minute_filter: string;
  filters: {
    seasons: string[];
    table_types: TableType[];
    round_filters: Record<string, string>;
    matchweek_filters: Record<string, string>;
    minute_filters: Record<string, string>;
  };
  table: StandingTeam[];
};

export type StandingsQuery = {
  season?: string;
  tableType?: TableType;
  roundFilter?: string;
  matchweekFilter?: string;
  minuteFilter?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function getStandings(query: StandingsQuery = {}): Promise<StandingsPayload> {
  const params = new URLSearchParams();

  if (query.season) params.set("season", query.season);
  if (query.tableType) params.set("table_type", query.tableType);
  if (query.roundFilter) params.set("round_filter", query.roundFilter);
  if (query.matchweekFilter) params.set("matchweek_filter", query.matchweekFilter);
  if (query.minuteFilter) params.set("minute_filter", query.minuteFilter);

  const response = await fetch(`${API_URL}/api/standings?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load standings: ${response.status}`);
  }

  const payload: StandingsPayload = await response.json();

  // Only needed for Home/Away tables where some teams may not have played yet.
  if (payload.table_type !== "Total") {
    const totalParams = new URLSearchParams(params);
    totalParams.set("table_type", "Total");

    const totalResponse = await fetch(`${API_URL}/api/standings?${totalParams}`, {
      cache: "no-store",
    });

    if (totalResponse.ok) {
      const totalPayload: StandingsPayload = await totalResponse.json();

      const existingTeams = new Map(
        payload.table.map((team) => [team.team_id, team]),
      );

      const completedTable = totalPayload.table.map((team) => {
        const existing = existingTeams.get(team.team_id);

        if (existing) {
          return existing;
        }

        return {
          ...team,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          goal_difference: 0,
          points: 0,
          rank: 0,
          form: [],
          form_history: [],
          form_matches: [],
          zone: "midtable" as StandingTeam["zone"],
        };
      });

      payload.table = completedTable
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.goal_difference - a.goal_difference ||
            b.goals_for - a.goals_for ||
            a.team_name.localeCompare(b.team_name),
        )
        .map((team, index) => ({
          ...team,
          rank: index + 1,
        }));
    }
  }

  return payload;
}

export function formPoints(form: string[]): number {
  return form.reduce((sum, result) => {
    if (result === "W") return sum + 3;
    if (result === "D") return sum + 1;
    return sum;
  }, 0);
}

export function goalDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
