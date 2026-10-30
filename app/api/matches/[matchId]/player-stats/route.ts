import { NextResponse } from "next/server";
import { database } from "@/lib/mongo";

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const bool = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

export async function GET(_: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const gameId = Number((await params).matchId);
  if (!Number.isInteger(gameId)) return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
  try {
    const db = await database();
    const [schedule, statsRows, lineupRows, keyEvents] = await Promise.all([
      db.collection("game_schedule").findOne({ game_id: gameId }, { projection: { _id: 0, home_team_id: 1, away_team_id: 1 } }),
      db.collection("game_player_stats").find({ game_id: gameId }, { projection: { _id: 0 } }).toArray(),
      db.collection("game_lineups").find({ game_id: gameId }, { projection: { _id: 0, team_id: 1, player_id: 1, player_name: 1, jersey_number: 1, starting_lineup: 1, starting_position: 1 } }).toArray(),
      db.collection("game_key_events").find({ game_id: gameId, event_type: "substitution" }, { projection: { _id: 0, player_id: 1, related_player_id: 1, minute: 1, minute_value: 1 } }).toArray(),
    ]);
    if (!schedule) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const substitutedOn = new Set(keyEvents.map((event) => numberOrNull(event.player_id)).filter((id): id is number => id !== null));
    const substitutionMinuteByPlayer = new Map<number, number>();
    for (const event of keyEvents) {
      const playerId = numberOrNull(event.player_id);
      const rawMinute = event.minute_value ?? event.minute;
      const minute = numberOrNull(rawMinute) ?? (typeof rawMinute === "string" ? Number.parseFloat(rawMinute) : null);
      if (playerId !== null && minute !== null) substitutionMinuteByPlayer.set(playerId, minute);
    }
    const lineupByPlayer = new Map<number, any>();
    for (const row of lineupRows) if (numberOrNull(row.player_id) !== null) lineupByPlayer.set(Number(row.player_id), row);
    const participantRows = lineupRows.filter((row) => {
      const playerId = numberOrNull(row.player_id);
      return playerId !== null && (bool(row.starting_lineup) || substitutedOn.has(playerId));
    });
    const statsByPlayer = new Map<number, any>();
    for (const row of statsRows) {
      const playerId = numberOrNull(row.player_id);
      if (playerId !== null) statsByPlayer.set(playerId, row);
    }
    const participantIds = new Set<number>(participantRows.map((row) => Number(row.player_id)));
    for (const row of statsRows) {
      const playerId = numberOrNull(row.player_id);
      const lineup = playerId === null ? null : lineupByPlayer.get(playerId);
      if (playerId !== null && (bool(row.starting_lineup) || substitutedOn.has(playerId) || lineup)) participantIds.add(playerId);
    }
    const players = Array.from(participantIds).flatMap((playerId) => {
      const lineup = lineupByPlayer.get(playerId);
      const row = statsByPlayer.get(playerId);
      const teamId = numberOrNull(row?.team_id ?? lineup?.team_id);
      if (teamId === null) return [];
      const rawPeriods = row?.stats && typeof row.stats === "object" ? row.stats : {};
      const periods = Object.fromEntries(Object.entries(rawPeriods).map(([period, values]) => [period, values && typeof values === "object" ? values : {}]));
      return [{
        playerId,
        teamId,
        name: String(row?.player ?? lineup?.player_name ?? "Player unavailable"),
        number: numberOrNull(lineup?.jersey_number),
        position: row?.position ?? lineup?.starting_position ?? null,
        starter: bool(row?.starting_lineup) || bool(lineup?.starting_lineup),
        entryMinute: substitutionMinuteByPlayer.get(playerId) ?? null,
        minutes: numberOrNull(row?.minutes_played),
        periods,
      }];
    });    const availablePeriods = Array.from(new Set(players.flatMap((player) => Object.keys(player.periods))));
    const orderedPeriods = ["ft", "fh", "sh", ...availablePeriods.filter((period) => !["ft", "fh", "sh", "per_90"].includes(period)), "per_90"].filter((period, index, all) => all.indexOf(period) === index);
    return NextResponse.json({ homeTeamId: numberOrNull(schedule.home_team_id), awayTeamId: numberOrNull(schedule.away_team_id), availablePeriods: orderedPeriods, players }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=1800" } });
  } catch (error) {
    console.error("Player statistics unavailable:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Player statistics are unavailable." }, { status: 503 });
  }
}

