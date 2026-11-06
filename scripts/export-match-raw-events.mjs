import { mkdir, writeFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

const matchId = Number(process.argv[2] ?? 1910902);
const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/";
const databaseName = process.env.MONGODB_DB ?? "WhoScored";
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

try {
  await client.connect();
  const events = await client
    .db(databaseName)
    .collection("game_raw_events")
    .find({ game_id: matchId }, { projection: { _id: 0 } })
    .sort({ event_idx: 1 })
    .toArray();

  if (!events.length) {
    throw new Error(`No raw events found for match ${matchId}.`);
  }

  await mkdir("exports", { recursive: true });
  const outputPath = `exports/${matchId}_raw_events.json`;
  await writeFile(outputPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
  console.log(`Exported ${events.length} raw events to ${outputPath}`);
} finally {
  await client.close();
}
