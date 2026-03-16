// DB abstraction layer — SQLite in dev, Vercel Postgres in production
// All queries use this interface so switching backends is one config change

import { SCHEMA_SQL } from './schema'

export type QueryResult<T> = T[]

export interface DB {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: unknown }>
  transaction<T>(fn: (db: DB) => Promise<T>): Promise<T>
}

// ─── SQLite (development) ────────────────────────────────────────────────────

function createSQLiteDB(): DB {
  // Dynamic import to avoid bundling in production
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  const path = require('path') as typeof import('path')
  const dbPath = path.join(process.cwd(), 'checkmark.db')
  const sqlite = new Database(dbPath) as import('better-sqlite3').Database

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = sqlite.prepare(sql)
      return stmt.all(...params) as T[]
    },
    async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = sqlite.prepare(sql)
      return (stmt.get(...params) as T) ?? null
    },
    async execute(sql: string, params: unknown[] = []) {
      const stmt = sqlite.prepare(sql)
      const result = stmt.run(...params)
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowid }
    },
    async transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
      // better-sqlite3 transactions are synchronous — wrap in a sync transaction
      let result: T
      const tx = sqlite.transaction(() => {
        // We can't await inside a sync transaction, so we run synchronously
        // This works because better-sqlite3 is synchronous under the hood
        result = undefined as unknown as T
      })
      tx()
      // For now, run fn outside transaction — proper async transactions require a queue
      result = await fn(this)
      return result
    },
  }
}

// ─── Vercel Postgres (production) ───────────────────────────────────────────

function createPostgresDB(): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sql } = require('@vercel/postgres')

  return {
    async query<T>(sqlStr: string, params: unknown[] = []): Promise<T[]> {
      const result = await sql.query(sqlStr, params)
      return result.rows as T[]
    },
    async queryOne<T>(sqlStr: string, params: unknown[] = []): Promise<T | null> {
      const result = await sql.query(sqlStr, params)
      return (result.rows[0] as T) ?? null
    },
    async execute(sqlStr: string, params: unknown[] = []) {
      const result = await sql.query(sqlStr, params)
      return { changes: result.rowCount ?? 0 }
    },
    async transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
      await sql`BEGIN`
      try {
        const result = await fn(this)
        await sql`COMMIT`
        return result
      } catch (err) {
        await sql`ROLLBACK`
        throw err
      }
    },
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _db: DB | null = null

export function getDB(): DB {
  if (_db) return _db

  const dbUrl = process.env.DATABASE_URL ?? ''
  if (dbUrl.startsWith('postgres')) {
    _db = createPostgresDB()
  } else {
    _db = createSQLiteDB()
  }

  return _db
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    return getDB()[prop as keyof DB]
  },
})

// Run migrations — called from scripts/migrate.js and on first import in dev
export async function runMigrations(): Promise<void> {
  const statements = SCHEMA_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const statement of statements) {
    await db.execute(statement)
  }
}
