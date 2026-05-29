import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CacheStore } from "./types.js";

interface SqliteRow {
  value: string;
  expires_at: number | null;
}

interface SqliteDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
}

export interface SqliteCacheOptions {
  path: string;
  defaultTtlSeconds?: number;
  now?: () => number;
  driver?: (path: string) => SqliteDb;
}

async function defaultDriver(path: string): Promise<SqliteDb> {
  // Dynamic import keeps better-sqlite3 optional at runtime.
  const mod = await import("better-sqlite3");
  const Database = mod.default;
  return new Database(path) as SqliteDb;
}

export class SqliteCacheStore implements CacheStore {
  private readonly db: SqliteDb;
  private readonly defaultTtl: number | undefined;
  private readonly now: () => number;

  private constructor(db: SqliteDb, opts: SqliteCacheOptions) {
    this.db = db;
    this.defaultTtl = opts.defaultTtlSeconds;
    this.now = opts.now ?? Date.now;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER
      );
    `);
  }

  static async open(opts: SqliteCacheOptions): Promise<SqliteCacheStore> {
    if (opts.path !== ":memory:") {
      mkdirSync(dirname(opts.path), { recursive: true });
    }
    const driver = opts.driver ? opts.driver : (p: string) => defaultDriver(p);
    const db = (await Promise.resolve(driver(opts.path))) as SqliteDb;
    return new SqliteCacheStore(db, opts);
  }

  async get<T>(key: string): Promise<T | null> {
    const row = this.db.prepare("SELECT value, expires_at FROM cache WHERE key = ?").get(key) as
      | SqliteRow
      | undefined;
    if (!row) return null;
    if (row.expires_at !== null && row.expires_at <= this.now()) {
      this.db.prepare("DELETE FROM cache WHERE key = ?").run(key);
      return null;
    }
    return JSON.parse(row.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    const expiresAt = ttl !== undefined && ttl > 0 ? this.now() + ttl * 1000 : null;
    this.db
      .prepare(
        "INSERT INTO cache(key, value, expires_at) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
      )
      .run(key, JSON.stringify(value), expiresAt);
  }

  async del(key: string): Promise<void> {
    this.db.prepare("DELETE FROM cache WHERE key = ?").run(key);
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.db.exec("DELETE FROM cache");
      return;
    }
    this.db.prepare("DELETE FROM cache WHERE key LIKE ?").run(`${prefix}%`);
  }

  async size(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM cache").get() as { c: number };
    return row.c;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
