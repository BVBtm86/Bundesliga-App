import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";

type TeamMeta = {
  ws_team_id?: number;
  ws_team_name?: string;
  fbre_team_name?: string;
  short_name?: string;
  team_name?: string;
};

type RawMatch = Record<string, any>;

const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dateValue = (value: unknown) => { const date = value instanceof Date ? value : new Date(String(value ?? "")); return Number.isNaN(date.getTime()) ? null : date; };
const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const isCompleted = (match: RawMatch, homeGoals: number | null, awayGoals: number | null) => {
  if (homeGoals === null || awayGoals === null || match.cancelled === true || match.abandoned === true) return false;
  const status = String(match.game_status ?? match.status ?? "").toLowerCase();
  return !status || /finished|complete|played|full.?time|final/.test(status);
};

export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const gameId = Number((await params).matchId);
  if (!Number.isInteger(gameId)) return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
  const query = new URL(request.url).searchParams;
  const venue = query.get("venue") === "home" ? "home" : "all";
  const requestedLimit = Number(query.get("limit") ?? "5");
  const limit = Math.min(1000, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 5));

  try {
    const db = await database();
    const [fixture, teams, modernMatches, historicalMatches] = await Promise.all([
      db.collection("game_schedule").findOne({ game_id: gameId, competition_name: "Bundesliga" }, { projection: { _id: 0, game_id: 1, season: 1, game_date: 1, home_team_id: 1, away_team_id: 1, home_team_name: 1, away_team_name: 1 } }),
      db.collection("available_teams").find({}, { projection: { _id: 0, ws_team_id: 1, ws_team_name: 1, fbre_team_name: 1, short_name: 1, team_name: 1 } }).toArray(),
      db.collection("game_schedule").find({ competition_name: "Bundesliga", competition_country: "Germany", game_status: { $in: ["finished", "complete", "played", "full_time"] } }, { projection: { _id: 0, game_id: 1, season: 1, game_date: 1, home_team_id: 1, away_team_id: 1, home_team_name: 1, away_team_name: 1, home_goals: 1, away_goals: 1, game_status: 1, cancelled: 1, abandoned: 1 } }).toArray(),
      db.collection("historical_results").find({ $or: [{ competition_name: "Bundesliga" }, { competition_name: { $exists: false } }] }, { projection: { _id: 1, game_id: 1, season: 1, game_date: 1, home_team_id: 1, away_team_id: 1, home_team_name: 1, away_team_name: 1, home_team_goals: 1, away_team_goals: 1, home_team_goals_ft: 1, away_team_goals_ft: 1, cancelled: 1, abandoned: 1, game_status: 1, competition_name: 1, competition_country: 1 } }).toArray().catch(() => [] as RawMatch[]),
    ]);
    if (!fixture) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    const idMeta = new Map<number, TeamMeta>();
    const nameMeta = new Map<string, TeamMeta>();
    for (const team of teams as TeamMeta[]) {
      if (typeof team.ws_team_id === "number") idMeta.set(team.ws_team_id, team);
      for (const value of [team.ws_team_name, team.fbre_team_name, team.short_name, team.team_name]) if (typeof value === "string" && value.trim()) nameMeta.set(normalize(value), team);
    }
    const resolveTeam = (id: unknown, name: unknown) => {
      const meta = (typeof id === "number" ? idMeta.get(id) : undefined) ?? nameMeta.get(normalize(name));
      const canonicalId = typeof meta?.ws_team_id === "number" ? meta.ws_team_id : typeof id === "number" ? id : null;
      const canonicalName = typeof meta?.team_name === "string" && meta.team_name.trim() ? meta.team_name.trim() : typeof name === "string" && name.trim() ? name.trim() : "Unknown team";
      return { id: canonicalId, name: canonicalName, key: canonicalId !== null ? `id:${canonicalId}` : `name:${normalize(name)}` };
    };

    const fixtureHome = resolveTeam(fixture.home_team_id, fixture.home_team_name);
    const fixtureAway = resolveTeam(fixture.away_team_id, fixture.away_team_name);
    const fixtureDate = dateValue(fixture.game_date);
    const modernReportIds = new Set((modernMatches as RawMatch[]).map(match => match.game_id).filter((id): id is number => typeof id === "number"));
    const candidates = [...(modernMatches as RawMatch[]).map(match => ({ source: "modern", match })), ...(historicalMatches as RawMatch[]).map(match => ({ source: "historical", match }))];
    const deduplicated = new Map<string, any>();

    for (const { source, match } of candidates) {
      const homeGoals = number(match.home_goals ?? match.home_team_goals ?? match.home_team_goals_ft);
      const awayGoals = number(match.away_goals ?? match.away_team_goals ?? match.away_team_goals_ft);
      const date = dateValue(match.game_date);
      if (!date || !isCompleted(match, homeGoals, awayGoals) || match.game_id === gameId || (fixtureDate && date >= fixtureDate)) continue;
      const home = resolveTeam(match.home_team_id, match.home_team_name);
      const away = resolveTeam(match.away_team_id, match.away_team_name);
      const samePair = (home.key === fixtureHome.key && away.key === fixtureAway.key) || (home.key === fixtureAway.key && away.key === fixtureHome.key);
      if (!samePair || (venue === "home" && home.key !== fixtureHome.key)) continue;
      const fixtureHomeGoals = home.key === fixtureHome.key ? homeGoals : awayGoals;
      const fixtureAwayGoals = home.key === fixtureAway.key ? awayGoals : homeGoals;
      const pair = [fixtureHome.key, fixtureAway.key].sort().join("|");
      const dedupeKey = `${pair}|${dateKey(date)}|${fixtureHomeGoals}|${fixtureAwayGoals}`;
      const current = deduplicated.get(dedupeKey);
      const reportId = typeof match.game_id === "number" && modernReportIds.has(match.game_id) ? match.game_id : null;
      if (!current || (source === "modern" && current.source !== "modern")) deduplicated.set(dedupeKey, {
        id: typeof match.game_id === "number" ? match.game_id : `historical-${String(match._id)}`,
        reportId,
        season: typeof match.season === "string" ? match.season : null,
        date: date.toISOString(), homeId: home.id, awayId: away.id, home: home.name, away: away.name,
        homeGoals, awayGoals, source,
      });
    }

    const results = Array.from(deduplicated.values()).sort((a, b) => b.date.localeCompare(a.date));
    const homeWins = results.filter(match => (match.homeId === fixtureHome.id ? match.homeGoals > match.awayGoals : match.awayGoals > match.homeGoals)).length;
    const awayWins = results.filter(match => (match.homeId === fixtureAway.id ? match.homeGoals > match.awayGoals : match.awayGoals > match.homeGoals)).length;
    const draws = results.filter(match => match.homeGoals === match.awayGoals).length;
    const homeGoals = results.reduce((sum, match) => sum + (match.homeId === fixtureHome.id ? match.homeGoals : match.awayGoals), 0);
    const awayGoals = results.reduce((sum, match) => sum + (match.homeId === fixtureAway.id ? match.homeGoals : match.awayGoals), 0);
    const meetings = results.length;
    return NextResponse.json({
      fixture: { homeId: fixtureHome.id, awayId: fixtureAway.id, home: fixtureHome.name, away: fixtureAway.name }, venue,
      totalMeetings: meetings, homeWins, draws, awayWins, homeGoals, awayGoals,
      averageGoals: meetings ? (homeGoals + awayGoals) / meetings : 0,
      homeWinPercentage: meetings ? homeWins / meetings * 100 : 0,
      awayWinPercentage: meetings ? awayWins / meetings * 100 : 0,
      results: results.slice(0, limit), pagination: { limit, returned: Math.min(limit, meetings), total: meetings, hasMore: meetings > limit },
    }, { headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    console.error("Historical H2H unavailable:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Historical head-to-head data is unavailable." }, { status: 503 });
  }
}
