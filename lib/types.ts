export type MatchPeriod = "ft" | "fh" | "sh" | "m_1_15" | "m_16_30" | "m_31_45" | "m_46_60" | "m_61_75" | "m_76_90" | "m_1_30" | "m_31_60" | "m_61_90";
export type SeasonPart = "all" | "first" | "second";
export type VenueFilter = "all" | "home" | "away";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "unknown";
export type Match = {
  id: number; season?: string; date: string; week: number; homeId: number; awayId: number;
  home: string; away: string; homeGoals: number | null; awayGoals: number | null;
  finished: boolean; status?: MatchStatus; venue: string; attendance: number | null; historical?: boolean;
};
export type Team = {
  id: number; name: string; played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; points: number; form: string[];
  earned_points?: number;
  official_points?: number;
  points_adjustment?: number;
  record_adjustment?: string;
  /** Set when the configured rules leave an ordering unresolved (for example a required play-off). */
  rankingStatus?: "resolved" | "tied" | "playoff_required";
};
export type PeriodStats = {
  goals: number | null; ownGoals?: number | null; shots: number | null; shotsOffTarget?: number | null; blockedShots?: number | null; onTarget: number | null;
  possession: number | null; touches?: number | null; lossOfPossession?: number | null; dispossessed?: number | null; turnovers?: number | null; passes: number | null; passCompletion: number | null;
  tackles?: number | null; tackleSuccess?: number | null; interceptions?: number | null; clearances?: number | null;
  successfulTackles?: number | null; blocks?: number | null; blockedShot?: number | null; errors?: number | null; recoveries?: number | null;
  shotAccuracy?: number | null; goalConversion?: number | null; openPlayShots?: number | null; penaltyShots?: number | null;
  completedPasses?: number | null; keyPasses?: number | null; assists?: number | null; throughBalls?: number | null; forwardPasses?: number | null;
  woodwork?: number | null; insideBoxShots?: number | null; outsideBoxShots?: number | null;
  setPieceShots?: number | null; fastbreakShots?: number | null; dribbles?: number | null; successfulDribbles?: number | null;
  offsides?: number | null; foulsWon?: number | null; foulsCommitted?: number | null; foulsSuffered?: number | null;
  yellowCards?: number | null; secondYellowCards?: number | null; redCards?: number | null;
  aerialDuels?: number | null; aerialDuelsWon?: number | null; saves?: number | null;
  goalkeeperActions?: number | null; claims?: number | null; punches?: number | null; keeperPickup?: number | null; keeperSweeper?: number | null;
  crosses?: number | null; completedCrosses?: number | null; crossCompletion?: number | null; longPasses?: number | null; completedLongPasses?: number | null; longPassAccuracy?: number | null;
  finalThirdPasses?: number | null; completedFinalThirdPasses?: number | null; finalThirdCompletion?: number | null; backwardPasses?: number | null;
  corners?: number | null;
};
export type MatchStats = Omit<PeriodStats,"goals"> & {
  gameId: number; teamId: number; periods?: Partial<Record<MatchPeriod,PeriodStats>>;
};
export type TeamLocation = {
  id: number;
  name: string;
  city?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  stadium?: string;
  logo?: string;
};
export type SeasonRules = {
  pointsForWin?: number;
  pointsForDraw?: number;
  teamCount?: number;
  matchdays?: number;
};
export type StandingsTiebreaker = string;
export type SeasonPointsAdjustment = { teamId: number; points: number; reason?: string };
export type SeasonRecordAdjustment = { teamId: number; type: string; reason?: string };
export type SeasonOutcomeClassification = {
  type: "champion" | "qualification" | "relegated" | "promoted" | "relegation_playoff" | string;
  competitionId: string;
  label: string;
  teamIds: number[];
};
export type SeasonConfig = {
  season: string;
  competition?: string;
  startYear?: number;
  endYear?: number;
  teamCount?: number;
  matchdays?: number;
  rules?: SeasonRules;
  standingsTiebreakers?: StandingsTiebreaker[];
  points_adjustments?: SeasonPointsAdjustment[];
  record_adjustments?: SeasonRecordAdjustment[];
  dataAvailability?: { historical?: boolean; modern?: boolean; supportedFeatures?: string[] };
  summary?: {
    verified?: boolean;
    champion?: string;
    championTeamId?: number;
    european_qualifications?: Array<{ competition: string; teams: string[] }>;
    relegated?: string[];
    outcomes?: SeasonOutcomeClassification[];
  };
  outcomes?: SeasonOutcomeClassification[];
};
export type Dashboard = {
  seasons: string[]; season: string; matches: Match[]; teams: Team[];
  stats: MatchStats[]; fullTeamNames?: Record<string,string>; shortTeamNames?: Record<string,string>; historicalMatches: Match[]; logos: Record<string,string>; stadiums: Record<string,string>; goalscorers: Record<string, Array<{teamId:number; playerName:string|null; minute:number|null; addedTime:number; subtype:string|null}>>; fetchedAt: string;
  teamLocations?: TeamLocation[];
  seasonConfigs?: SeasonConfig[];
};
export type TimelineEvent = {
  id: string; teamId: number; minute: string; second?: number | null; type: "goal" | "penalty-miss" | "yellow" | "second-yellow" | "red" | "substitution";
  player: string | null; playerTeamName?: string | null; period?: string | null; replacement?: string | null; detail?: string | null;
};
