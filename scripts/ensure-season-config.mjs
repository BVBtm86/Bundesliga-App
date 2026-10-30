import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/", { serverSelectionTimeoutMS: 5000 });
const dbName = process.env.MONGODB_DB ?? "WhoScored";

const seasonStart = season => Number(String(season).slice(0, 4));
const isSeason = value => typeof value === "string" && /^\d{4}-\d{4}$/.test(value);

await client.connect();
const db = client.db(dbName);
const schedule = await db.collection("game_schedule").find({ competition_name: "Bundesliga", competition_country: "Germany" }, { projection: { season: 1, week: 1, home_team_id: 1, away_team_id: 1 } }).toArray();
const historical = await db.collection("historical_results").find({}, { projection: { season: 1, week: 1, home_team_id: 1, away_team_id: 1 } }).toArray();
const bySeason = new Map();
for (const [row, source] of [...schedule.map(row => [row, "modern"]), ...historical.map(row => [row, "historical"])]) {
  if (!isSeason(row.season)) continue;
  const current = bySeason.get(row.season) ?? { teams: new Set(), matchdays: new Set(), historical: false, modern: false };
  if (row.home_team_id != null) current.teams.add(Number(row.home_team_id));
  if (row.away_team_id != null) current.teams.add(Number(row.away_team_id));
  if (row.week != null) current.matchdays.add(Number(row.week));
  current[source] = true;
  bySeason.set(row.season, current);
}

const collection = db.collection("season_config");
await collection.createIndex({ season: 1 }, { unique: true });
for (const [season, values] of bySeason) {
  const startYear = seasonStart(season);
  const document = {
    competition: "Bundesliga",
    season,
    start_year: startYear,
    end_year: startYear + 1,
    team_count: values.teams.size,
    matchdays: values.matchdays.size,
    rules: { pointsForWin: startYear >= 1995 ? 3 : 2, pointsForDraw: 1 },
    data_availability: { historical: values.historical, modern: values.modern, supportedFeatures: ["standings", "season_summary"] },
    summary: { classifications: [] }
  };
  await collection.updateOne({ season }, { $setOnInsert: document }, { upsert: true });
}
await client.close();
console.log(`Ensured ${bySeason.size} season_config documents without overwriting verified summaries.`);
