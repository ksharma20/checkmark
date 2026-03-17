#!/usr/bin/env node
/**
 * migrate-v7.js
 *  - workspaces.archived_at     — soft-archive workspaces (admin action)
 *  - presence_events.checkout_reason — reason for checkout (e.g. 'maximum_hours_exceeded')
 * Idempotent: skips "duplicate column" errors.
 */
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.resolve(__dirname, '../checkmark.db')
const db = new Database(DB_PATH)

const statements = [
  `ALTER TABLE workspaces ADD COLUMN archived_at TEXT`,
  `ALTER TABLE presence_events ADD COLUMN checkout_reason TEXT`,
]

let executed = 0, skipped = 0, errors = 0

for (const sql of statements) {
  try {
    db.prepare(sql).run()
    console.log(`✓  ${sql}`)
    executed++
  } catch (err) {
    const msg = err.message ?? ''
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log(`—  (skip) ${sql}`)
      skipped++
    } else {
      console.error(`✗  ${sql}\n   ${msg}`)
      errors++
    }
  }
}

db.close()
console.log(`\nMigrate-v7: ${executed} executed, ${skipped} skipped, ${errors} errors`)
if (errors > 0) process.exit(1)
