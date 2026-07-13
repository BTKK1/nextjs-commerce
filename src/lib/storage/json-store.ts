import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createSeedDatabase } from "@/lib/storage/seed";
import type { DemoDatabase } from "@/lib/types";

let memoryDb: DemoDatabase | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getDatabasePath(): string {
  if (process.env.DEMO_DATA_FILE) return process.env.DEMO_DATA_FILE;
  if (process.env.VERCEL) return join(tmpdir(), "saleh-demo-db.json");
  return join(/*turbopackIgnore: true*/ process.cwd(), ".local", "demo-db.json");
}

function shouldUseMemoryStore(): boolean {
  return process.env.DEMO_PERSISTENCE === "memory";
}

export function loadDatabase(): DemoDatabase {
  if (shouldUseMemoryStore()) {
    memoryDb ??= createSeedDatabase();
    return clone(memoryDb);
  }

  const dbPath = getDatabasePath();
  const dbDir = dirname(dbPath);
  if (!existsSync(/*turbopackIgnore: true*/ dbPath)) {
    mkdirSync(/*turbopackIgnore: true*/ dbDir, { recursive: true });
    writeFileSync(/*turbopackIgnore: true*/ dbPath, `${JSON.stringify(createSeedDatabase(), null, 2)}\n`, "utf8");
  }

  const seed = createSeedDatabase();
  const parsed = JSON.parse(readFileSync(/*turbopackIgnore: true*/ dbPath, "utf8")) as Partial<DemoDatabase>;
  return {
    ...seed,
    ...parsed,
    merchants: parsed.merchants?.length ? parsed.merchants : seed.merchants,
    products: parsed.products?.length ? parsed.products : seed.products
  };
}

export function saveDatabase(db: DemoDatabase): void {
  if (shouldUseMemoryStore()) {
    memoryDb = clone(db);
    return;
  }

  const dbPath = getDatabasePath();
  const dbDir = dirname(dbPath);
  mkdirSync(/*turbopackIgnore: true*/ dbDir, { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

export function resetDatabaseForTests(db: DemoDatabase = createSeedDatabase()): void {
  memoryDb = clone(db);
  if (!shouldUseMemoryStore()) {
    saveDatabase(db);
  }
}

export function mutateDatabase<T>(mutator: (db: DemoDatabase) => T): T {
  const db = loadDatabase();
  const result = mutator(db);
  saveDatabase(db);
  return result;
}
