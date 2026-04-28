// DB abstraction layer - better-sqlite3 (local dev) | Turso/libSQL (production)
// All query files use this interface; switching backends requires no query changes.

import { en } from "@/locales/en";

export type QueryResult<T> = T[];

export interface DB {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T | null>;
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ changes: number; lastInsertRowid?: unknown }>;
  transaction<T>(fn: (db: DB) => Promise<T>): Promise<T>;
}

// ─── SQLite via better-sqlite3 (local dev) ───────────────────────────────────

function createSQLiteDB(): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const path = require("path") as typeof import("path");
  const dbPath = path.join(process.cwd(), en.constants.dbFile);
  const sqlite = new Database(dbPath) as import("better-sqlite3").Database;

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      return (sqlite.prepare(sql).get(...params) as T) ?? null;
    },
    async execute(sql: string, params: unknown[] = []) {
      const result = sqlite.prepare(sql).run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
    async transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
      return fn(this);
    },
  };
}

// ─── Turso / libSQL (production) ─────────────────────────────────────────────

function createTursoDB(): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client");
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // libSQL Row objects have a special prototype - spread into plain objects
  // so they can safely cross the Server → Client Component boundary.
  const toPlain = <T>(row: unknown): T => ({ ...(row as object) }) as T

  const makeDB = (executor: typeof client): DB => ({
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await executor.execute({ sql, args: params as never[] });
      return result.rows.map(toPlain<T>);
    },
    async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const result = await executor.execute({ sql, args: params as never[] });
      return result.rows[0] ? toPlain<T>(result.rows[0]) : null;
    },
    async execute(sql: string, params: unknown[] = []) {
      const result = await executor.execute({ sql, args: params as never[] });
      return {
        changes: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
    async transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
      const tx = await client.transaction("write");
      try {
        const result = await fn(makeDB(tx));
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    },
  });

  return makeDB(client);
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _db: DB | null = null;

export function getDB(): DB {
  if (_db) return _db;
  _db = process.env.TURSO_DATABASE_URL ? createTursoDB() : createSQLiteDB();
  return _db;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    return getDB()[prop as keyof DB];
  },
});
