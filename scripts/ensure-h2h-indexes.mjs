import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27018/";
const databaseName = process.env.MONGO_DATABASE ?? "WhoScored";
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(databaseName);
  await Promise.all([
    db.collection("game_schedule").createIndex(
      { competition_name: 1, competition_country: 1, game_status: 1, game_date: -1, home_team_id: 1, away_team_id: 1 },
      { name: "h2h_schedule_lookup" },
    ),
    db.collection("game_schedule").createIndex(
      { competition_name: 1, competition_country: 1, season: 1, game_status: 1, game_date: -1 },
      { name: "dashboard_schedule_lookup" },
    ),
    db.collection("historical_results").createIndex(
      { game_date: -1, home_team_id: 1, away_team_id: 1 },
      { name: "h2h_historical_lookup" },
    ),
    db.collection("historical_results").createIndex(
      { season: 1, game_date: -1 },
      { name: "dashboard_historical_lookup" },
    ),
    db.collection("game_team_stats").createIndex(
      { competition_name: 1, season: 1, game_id: 1 },
      { name: "dashboard_team_stats_lookup" },
    ),
    db.collection("game_key_events").createIndex(
      { game_id: 1, event_type: 1 },
      { name: "dashboard_key_events_lookup" },
    ),
    db.collection("available_teams").createIndex(
      { ws_team_id: 1 },
      { name: "h2h_team_identity_lookup" },
    ),
  ]);
  console.log(`H2H indexes ensured in ${databaseName}.`);
} finally {
  await client.close();
}
