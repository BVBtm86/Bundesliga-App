import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { MongoClient } from "mongodb";

const matchId = process.argv[2];
if (!matchId) {
  console.error("Usage: node scripts/export-match-processed-events.mjs <matchId>");
  process.exit(1);
}

const mongoUri = process.env.MONGO_URI ?? "mongodb://localhost:27017";
const databaseName = process.env.MONGO_DATABASE ?? "WhoScored";
const collectionName = process.env.MONGO_COLLECTION ?? "game_processed_events";
const numericMatchId = Number(matchId);
const ids = Number.isSafeInteger(numericMatchId) ? [numericMatchId, matchId] : [matchId];

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  const collection = client.db(databaseName).collection(collectionName);
  const events = await collection
    .find({ game_id: { $in: ids } }, { projection: { _id: 0 } })
    .sort({ event_idx: 1, _id: 1 })
    .toArray();

  if (!events.length) {
    throw new Error(`No processed events found for match ${matchId}`);
  }

  const outputDirectory = path.resolve(process.cwd(), "exports");
  const outputPath = path.join(outputDirectory, `${matchId}_processed_events.json`);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");

  for (const sequenceCollection of ["game_shot_sequences", "game_pass_sequences"]) {
    const sequences = await client
      .db(databaseName)
      .collection(sequenceCollection)
      .find({ game_id: { $in: ids } }, { projection: { _id: 0 } })
      .sort({ sequence_id: 1, sequence_event: 1, event_idx: 1 })
      .toArray();
    const sequencePath = path.join(outputDirectory, `${matchId}_${sequenceCollection}.json`);
    await writeFile(sequencePath, `${JSON.stringify(sequences, null, 2)}\n`, "utf8");
    console.log(`Exported ${sequences.length} rows from ${sequenceCollection}`);
    console.log(sequencePath);
  }

  const seasons = [...new Set(events.map((event) => event.season).filter(Boolean))];
  console.log(`Exported ${events.length} processed events for ${matchId}`);
  console.log(`Season(s): ${seasons.join(", ") || "unknown"}`);
  console.log(outputPath);
} finally {
  await client.close();
}
