import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/";
const dbName = process.env.MONGODB_DB ?? "WhoScored";

const indexes = {
  game_schedule: [[{ game_id: 1, competition_name: 1 }, { name: "match_schedule_lookup" }]],
  game_team_stats: [[{ game_id: 1, competition_name: 1 }, { name: "match_team_stats_lookup" }]],
  game_lineups: [[{ game_id: 1, competition_name: 1 }, { name: "match_lineups_lookup" }]],
  game_formations: [[{ game_id: 1, competition_name: 1 }, { name: "match_formations_lookup" }]],
  game_processed_events: [
    [{ game_id: 1, competition_name: 1 }, { name: "match_processed_events_lookup" }],
    [{ game_id: 1, competition_name: 1, shot_event: 1, event_idx: 1 }, { name: "match_shots" }],
    [{ game_id: 1, competition_name: 1, shot_is_goal: 1, goal_assist: 1 }, { name: "match_goal_assists" }],
    [{ game_id: 1, competition_name: 1, player_id: 1 }, { name: "match_player_lookup" }],
  ],
  game_shot_sequences: [[{ game_id: 1 }, { name: "match_shot_sequences" }]],
  game_pass_sequences: [[{ game_id: 1 }, { name: "match_pass_sequences" }]],
  game_key_events: [[{ game_id: 1, minute: 1, second: 1, event_id: 1 }, { name: "match_timeline" }]],
  formation_coordinates: [
    [{ formation_key: 1 }, { name: "formation_key_lookup" }],
    [{ formation_name: 1 }, { name: "formation_name_lookup" }],
  ],
};

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  for (const [collectionName, collectionIndexes] of Object.entries(indexes)) {
    const collection = db.collection(collectionName);
    for (const [key, options] of collectionIndexes) {
      await collection.createIndex(key, options);
      console.log(`${collectionName}: ${options.name}`);
    }
  }
} finally {
  await client.close();
}
