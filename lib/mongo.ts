import "server-only";
import { MongoClient } from "mongodb";

const globalMongo = globalThis as typeof globalThis & { bundesligaMongo?: Promise<MongoClient> };

export async function database() {
  if (!globalMongo.bundesligaMongo) {
    const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/", {
      serverSelectionTimeoutMS: 5000, maxPoolSize: 5
    });
    globalMongo.bundesligaMongo = client.connect().catch(async error => {
      globalMongo.bundesligaMongo = undefined;
      await client.close();
      throw error;
    });
  }
  return (await globalMongo.bundesligaMongo).db(process.env.MONGODB_DB ?? "WhoScored");
}

