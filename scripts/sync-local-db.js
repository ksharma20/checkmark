#!/usr/bin/env node
// Sync the local SQLite database from Turso.
//
// Usage:
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:sync
//
// The script creates a fresh SQLite file from Turso schema + data, backs up the
// current local DB, then swaps the fresh copy into place.
//
// Blob tables are created locally but their rows are skipped - see
// SYNC_EXCLUDED_TABLES below. Set SYNC_INCLUDE_BLOBS=1 to copy them anyway.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DEFAULT_LOCAL_DB = path.join(ROOT, 'checkmark.db')
const BATCH_SIZE = 500

// Tables whose SCHEMA is still created locally but whose ROWS are never copied.
//
// employee_document_blobs stores document bytes as base64 TEXT (2 MB cap per
// file), which is payload, not reference data. Copying it drags every real
// document byte onto a laptop and makes the local snapshot grow without bound.
// The metadata row in employee_documents still syncs, so the UI renders the
// document list correctly - only the downloadable bytes are missing locally.
//
// The table is still CREATEd: skipping the create would break `npm run dev` on
// any query that joins it.
const SYNC_EXCLUDED_TABLES = new Set(['employee_document_blobs'])

// Escape hatch for anyone debugging a document bug who actually needs the bytes.
function shouldSkipRows(tableName) {
  if (process.env.SYNC_INCLUDE_BLOBS === '1') return false
  return SYNC_EXCLUDED_TABLES.has(tableName)
}

function loadDotEnvLocal() {
  // .env.sync.local first: it holds the Turso production credentials, which are
  // deliberately kept OUT of .env.local. Next.js auto-loads .env.local, and
  // src/lib/db/index.ts switches to Turso whenever TURSO_DATABASE_URL is set -
  // so keeping them there would silently point `npm run dev` at production.
  // Shell-provided values still win: loadEnvFile never overwrites process.env.
  for (const file of ['.env.sync.local', '.env.local']) loadEnvFile(path.join(ROOT, file))
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue

    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
  }
}

function quoteIdent(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`
}

function tableExists(db, tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?")
    .get(tableName)
  return Boolean(row)
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath)
}

function backupExistingLocalDb(localDbPath) {
  if (!fs.existsSync(localDbPath)) return null

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${localDbPath}.backup-${stamp}`
  fs.copyFileSync(localDbPath, backupPath)
  return backupPath
}

async function fetchRows(client, tableName, offset) {
  const result = await client.execute({
    sql: `SELECT * FROM ${quoteIdent(tableName)} LIMIT ? OFFSET ?`,
    args: [BATCH_SIZE, offset],
  })
  return result.rows.map((row) => ({ ...row }))
}

async function countRows(client, tableName) {
  const result = await client.execute(`SELECT COUNT(*) AS count FROM ${quoteIdent(tableName)}`)
  return Number(result.rows[0]?.count ?? 0)
}

async function main() {
  loadDotEnvLocal()

  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required. Add it to .env.local or pass it inline.')
  }

  const localDbPath = path.resolve(process.env.LOCAL_DATABASE_PATH || DEFAULT_LOCAL_DB)
  const tmpDbPath = `${localDbPath}.sync-tmp`

  const { createClient } = require('@libsql/client')
  const Database = require('better-sqlite3')

  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  removeIfExists(tmpDbPath)
  removeIfExists(`${tmpDbPath}-wal`)
  removeIfExists(`${tmpDbPath}-shm`)

  const local = new Database(tmpDbPath)

  try {
    local.pragma('journal_mode = WAL')
    local.pragma('foreign_keys = OFF')

    const schemaResult = await turso.execute(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_schema
      WHERE sql IS NOT NULL
        AND name NOT LIKE 'sqlite_%'
      ORDER BY CASE type
        WHEN 'table' THEN 0
        WHEN 'view' THEN 1
        WHEN 'index' THEN 2
        WHEN 'trigger' THEN 3
        ELSE 4
      END, name
    `)

    const schemaRows = schemaResult.rows.map((row) => ({ ...row }))
    const tableRows = schemaRows.filter((row) => row.type === 'table')
    const postDataRows = schemaRows.filter((row) => row.type !== 'table')

    if (tableRows.length === 0) {
      throw new Error('No tables found in Turso. Refusing to replace the local database.')
    }

    for (const row of tableRows) {
      local.exec(row.sql)
    }

    let insertedRows = 0
    for (const table of tableRows) {
      const tableName = table.name

      if (shouldSkipRows(tableName)) {
        const skippedCount = await countRows(turso, tableName)
        console.log(`Skipped ${tableName} (${skippedCount} row(s) — blob storage)`)
        continue
      }

      const columns = local
        .prepare(`PRAGMA table_info(${quoteIdent(tableName)})`)
        .all()
        .map((column) => column.name)

      const placeholders = columns.map((column) => `@${column}`).join(', ')
      const statement = local.prepare(`
        INSERT INTO ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(', ')})
        VALUES (${placeholders})
      `)

      const insertAll = local.transaction((records) => {
        for (const record of records) statement.run(record)
      })

      let tableCount = 0
      for (let offset = 0; ; offset += BATCH_SIZE) {
        const rows = await fetchRows(turso, tableName, offset)
        if (rows.length === 0) break

        insertAll(rows)
        tableCount += rows.length
      }

      insertedRows += tableCount
      console.log(`Synced ${tableCount} row(s) from ${tableName}`)
    }

    for (const row of postDataRows) {
      local.exec(row.sql)
    }

    if (tableExists(local, 'sqlite_sequence')) {
      const sequenceResult = await turso.execute('SELECT name, seq FROM sqlite_sequence')
      const sequenceRows = sequenceResult.rows.map((row) => ({ ...row }))
      if (sequenceRows.length > 0) {
        const insertSequence = local.prepare(`
          INSERT OR REPLACE INTO sqlite_sequence (name, seq)
          VALUES (@name, @seq)
        `)
        const insertAllSequences = local.transaction((records) => {
          for (const record of records) insertSequence.run(record)
        })
        insertAllSequences(sequenceRows)
      }
    }

    const integrity = local.prepare('PRAGMA integrity_check').get()
    if (integrity.integrity_check !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${JSON.stringify(integrity)}`)
    }

    const foreignKeyFailures = local.prepare('PRAGMA foreign_key_check').all()
    if (foreignKeyFailures.length > 0) {
      throw new Error(`Foreign key check failed: ${JSON.stringify(foreignKeyFailures)}`)
    }

    local.pragma('wal_checkpoint(TRUNCATE)')
    local.close()

    const backupPath = backupExistingLocalDb(localDbPath)
    removeIfExists(`${localDbPath}-wal`)
    removeIfExists(`${localDbPath}-shm`)
    fs.renameSync(tmpDbPath, localDbPath)
    removeIfExists(`${tmpDbPath}-wal`)
    removeIfExists(`${tmpDbPath}-shm`)

    console.log(`\nDone. Synced ${insertedRows} row(s) across ${tableRows.length} table(s).`)
    console.log(`Local database: ${localDbPath}`)
    if (backupPath) console.log(`Backup: ${backupPath}`)
  } catch (err) {
    try { local.close() } catch {}
    removeIfExists(tmpDbPath)
    removeIfExists(`${tmpDbPath}-wal`)
    removeIfExists(`${tmpDbPath}-shm`)
    throw err
  } finally {
    await turso.close()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
