import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { __setTestDb } from "./void-db.ts";

const migrationsFolder = fileURLToPath(new URL("../../../apps/api/db/migrations", import.meta.url));

export type TestDb = ReturnType<typeof createTestDb>["db"];

export interface TestDatabase {
  db: ReturnType<typeof drizzle>;
  close(): void;
}

// Create a fresh, migrated in-memory SQLite database and wire it up as the
// database behind `void/db`'s `db` export.
export function createTestDb(): TestDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  __setTestDb(db);
  return {
    db,
    close: () => sqlite.close(),
  };
}
