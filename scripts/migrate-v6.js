#!/usr/bin/env node
/**
 * migrate-v6.js
 *  - revoked_tokens table — JWT jti revocation on logout
 * Idempotent: skips "already exists" errors.
 */
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.resolve(__dirname, '../checkmark.db')
const db = new Database(DB_PATH)

const statements = [
  `CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti        TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL,
    revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at)`,
]

let executed = 0, skipped = 0, errors = 0

for (const sql of statements) {
  try {
    db.prepare(sql).run()
    console.log(`✓  ${sql.slice(0, 72).replace(/\n/g, ' ')}`)
    executed++
  } catch (err) {
    const msg = err.message ?? ''
    if (msg.includes('already exists')) {
      console.log(`—  (skip) ${sql.slice(0, 60).replace(/\n/g, ' ')}`)
      skipped++
    } else {
      console.error(`✗  ${sql.slice(0, 72)}\n   ${msg}`)
      errors++
    }
  }
}

db.close()
console.log(`\nMigrate-v6: ${executed} executed, ${skipped} skipped, ${errors} errors`)
if (errors > 0) process.exit(1)
