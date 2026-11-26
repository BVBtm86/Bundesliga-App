import { MongoClient, type AnyBulkWriteOperation, type Filter } from "mongodb";
import { importedTeamStatsProjection, normalizeImportedTeamStats, type ImportedTeamStats } from "../lib/imported-team-statistics";
import { buildTacticalTeamMatches, TACTICAL_DNA_VERSION, TACTICAL_PERIODS, type TacticalTeamMatch } from "../lib/tactical-dna";

import {
  summarizeTacticalPassing,
  TACTICAL_PASSING_VERSION,
  type EventPassingSummary,
  type ImportedPassEvent
} from "../lib/tactical-passing";

type Fixture = {
  game_id: number;
  season: string;
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_goals: number;
  away_goals: number;
  competition_name: string;
  competition_country: string;
  game_status: string;
};

type MatchDocument = {
  matchId: number;
  season: string;
  matchday: number;
  teamIds: number[];
  version: number;
  completeFullTimeCoverage: boolean;
  passingVersion: number;
  records: Array<TacticalTeamMatch & { passing: EventPassingSummary | null; lineupMinutes?: Record<number, number> }>;
};

const collectionName = "game_tactical_dna_app";
const batchSize = 32;
const statPeriods = importedTeamStatsProjection(TACTICAL_PERIODS);

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const matchArg = args.find(arg => arg.startsWith("--match="));
  const matchId = matchArg ? Number(matchArg.slice("--match=".length)) : undefined;
  if (args.some(arg => arg !== "--write" && arg !== matchArg) ||
      (matchArg && (!Number.isSafeInteger(matchId) || matchId! <= 0))) {
    throw new Error("Usage: build-tactical-dna.ts [--write] [--match=1910902]");
  }

  const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/", {serverSelectionTimeoutMS: 5000});
  const started = performance.now();
  try {
    const db = client.db(process.env.MONGODB_DB ?? "WhoScored");
    const documents = db.collection<MatchDocument>(collectionName);
    if (write) {
      await documents.createIndexes([
        { key: { version: 1, matchId: 1 }, unique: true },
        { key: { version: 1, season: 1, matchday: 1, teamIds: 1 } }
      ]);
    }
    const filter: Filter<Fixture> = {
      competition_name: "Bundesliga", competition_country: "Germany", game_status: "finished",
      season: { $gte: "2009-2010", $regex: /^\d{4}-\d{4}$/ },
      game_id: matchId ?? { $gt: 0 },
      home_goals: { $gte: 0 }, away_goals: { $gte: 0 }
    };
    const fixtures = db.collection<Fixture>("game_schedule").find(filter, { projection: {
      _id: 0, game_id: 1, season: 1, week: 1, home_team_id: 1, away_team_id: 1, home_goals: 1, away_goals: 1
    }}).sort({ game_id: 1 }).batchSize(batchSize);
    let scanned = 0;
    let built = 0;
    let partial = 0;
    const seasonRows = new Map<string, number>();
    let batch = new Map<number, Fixture>();
    async function processBatch(fixturesById: Map<number, Fixture>) {
      const ids = [...fixturesById.keys()];
      const covered = matchId === undefined ? new Set(await documents.distinct("matchId", {
        matchId: { $in: ids }, version: TACTICAL_DNA_VERSION, passingVersion: TACTICAL_PASSING_VERSION, completeFullTimeCoverage: true
      })) : new Set<number>();
      const pending = ids.filter(id => !covered.has(id));
      if (!pending.length) return;
      const stats = db.collection<ImportedTeamStats>("game_team_stats_app").find({ game_id: { $in: pending } }, { projection: statPeriods });
      const statsByMatch = new Map<number, ReturnType<typeof normalizeImportedTeamStats>[]>();
      for await (const raw of stats) {
        const rows = statsByMatch.get(raw.game_id) ?? [];
        rows.push(normalizeImportedTeamStats(raw));
        statsByMatch.set(raw.game_id, rows);
      }
      const passEventsByMatch = new Map<number, ImportedPassEvent[]>();
      const passEvents = db.collection<ImportedPassEvent>("game_processed_events_app")
        .find({ game_id: { $in: pending }, categories: "pass", pass_attempt: true }, { projection: {
          _id: 0, game_id: 1, event_idx: 1, team_id: 1, player_id: 1, player: 1, period: 1, x: 1, y: 1, end_x: 1, end_y: 1, pass_completed: 1
        }});
      for await (const event of passEvents) {
        const group = passEventsByMatch.get(event.game_id) ?? [];
        group.push(event);
        passEventsByMatch.set(event.game_id, group);
      }
      const lineupByMatch = new Map<string, Record<number, number>>();
      const lineups = db.collection("game_lineups").find({ game_id: { $in: pending }, played: true }, { projection: {
        _id: 0, game_id: 1, team_id: 1, player_id: 1, minutes_played: 1
      }});
      for await (const lineup of lineups) {
        if (!Number.isSafeInteger(lineup.player_id) || typeof lineup.minutes_played !== "number" ||
            !Number.isFinite(lineup.minutes_played) || lineup.minutes_played < 0 || lineup.minutes_played > 150) continue;
        const key = `${lineup.game_id}:${lineup.team_id}`;
        const minutes = lineupByMatch.get(key) ?? {};
        minutes[lineup.player_id] = lineup.minutes_played;
        lineupByMatch.set(key, minutes);
      }
      const operations: AnyBulkWriteOperation<MatchDocument>[] = [];
      for (const id of pending) {
        const fixture = fixturesById.get(id)!;
        const records = buildTacticalTeamMatches({
          id, season: fixture.season, week: fixture.week, finished: true,
          homeId: fixture.home_team_id, awayId: fixture.away_team_id,
          homeGoals: fixture.home_goals, awayGoals: fixture.away_goals
        }, statsByMatch.get(id) ?? []).map(row => ({
          ...row, passing: summarizeTacticalPassing(passEventsByMatch.get(id) ?? [], row.teamId, row.period),
          ...(row.period === "ft" ? { lineupMinutes: lineupByMatch.get(`${id}:${row.teamId}`) } : {})
        }));
        const completeFullTimeCoverage = records.filter(row => row.period === "ft" && Object.keys(row.team).length > 0).length === 2;
        if (!completeFullTimeCoverage) partial++;
        const replacement = {
          matchId: id, season: fixture.season, matchday: fixture.week,
          teamIds: [fixture.home_team_id, fixture.away_team_id],
          version: TACTICAL_DNA_VERSION, passingVersion: TACTICAL_PASSING_VERSION, completeFullTimeCoverage, records
        };
        operations.push({ replaceOne: { filter: { matchId: id, version: TACTICAL_DNA_VERSION }, replacement, upsert: true } });
        built++;
        seasonRows.set(fixture.season, (seasonRows.get(fixture.season) ?? 0) + 1);
      }
      if (write) await documents.bulkWrite(operations, { ordered: false });
    }
    for await (const fixture of fixtures) {
      scanned++;
      batch.set(fixture.game_id, fixture);
      if (batch.size < batchSize) continue;
      await processBatch(batch);
      batch = new Map();
    }
    if (batch.size) await processBatch(batch);
    if (matchId !== undefined && !scanned) throw new Error(`No eligible completed fixture for match ${matchId}.`);
    console.log(JSON.stringify({ write, scanned, built, partial, seasons: Object.fromEntries(seasonRows), elapsedMs: Math.round(performance.now() - started) }));
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
